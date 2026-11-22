"""
Unit tests for the MT5 bridge volume grid, symbol specification and read-only
risk calculation code in app.py.

These tests never reach a terminal: MetaTrader5 is replaced by a stub before
app.py is imported, and the stub raises for every order function.
"""

import collections
import inspect
import os
import sys
import unittest
from decimal import Decimal


# ----------------------------------------------------------
# STUB THE BROKER BEFORE app.py IS IMPORTED
# ----------------------------------------------------------

class ForbiddenOrderCall(AssertionError):
    pass


ORDER_FUNCTIONS = (
    "order_send",
    "order_send_async",
    "order_check",
    "order_calc_margin",
    "positions_close",
    "trade_transaction",
)


class StubMT5:
    """
    Minimal MetaTrader5 stand-in.

    Only the calls the read-only paths need are implemented. Order submission
    functions raise, so no test can place an order even by accident, and unknown
    lower-case names raise too, so a typo cannot silently become a 0.
    """

    ORDER_TYPE_BUY = 0
    ORDER_TYPE_SELL = 1

    def __init__(self):
        self.symbol_records = {}
        self.account_currency = "USD"
        self.profit_results = []
        self.symbol_info_calls = []
        self.order_calc_profit_calls = []
        self._constants = {}
        self._next_constant = 1000

    # -- symbol ------------------------------------------------

    def symbol_info(self, symbol):
        self.symbol_info_calls.append(symbol)

        return self.symbol_records.get(symbol)

    def symbol_select(self, symbol, enable):
        return True

    # -- account -----------------------------------------------

    def account_info(self):
        record = collections.namedtuple(
            "AccountInfo",
            ["currency"],
        )

        return record(currency=self.account_currency)

    def last_error(self):
        return (4002, "Unknown trade symbol (stub)")

    # -- read-only calculation ---------------------------------

    def order_calc_profit(
        self,
        action,
        symbol,
        volume,
        price_open,
        price_close,
    ):
        self.order_calc_profit_calls.append(
            {
                "action": action,
                "symbol": symbol,
                "volume": volume,
                "price_open": price_open,
                "price_close": price_close,
            }
        )

        if not self.profit_results:
            return None

        result = self.profit_results.pop(0)

        if result == "raise":
            raise RuntimeError("stub broker failure")

        return result

    # -- everything else ---------------------------------------

    def __getattr__(self, name):
        if name in ORDER_FUNCTIONS:
            def fail(*args, **kwargs):
                raise ForbiddenOrderCall(
                    f"{name} must never be called by these tests"
                )

            return fail

        # MT5 constants are plain integers and app.py builds module-level
        # lookup tables from them. Each unknown upper-case name gets its own
        # stable integer, so distinct order types stay distinct.
        if name.isupper() and name.replace("_", "").isalnum():
            if name not in self._constants:
                self._constants[name] = self._next_constant
                self._next_constant += 1

            return self._constants[name]

        raise AttributeError(
            f"The MetaTrader5 stub has no {name!r}. Add it deliberately if a "
            "tested path really needs it."
        )


stub_mt5 = StubMT5()
sys.modules["MetaTrader5"] = stub_mt5

sys.path.insert(
    0,
    os.path.dirname(
        os.path.abspath(__file__)
    ),
)

import app  # noqa: E402  (the stub above must be installed first)


if app.mt5 is not stub_mt5:
    raise RuntimeError(
        "app.py bound a real MetaTrader5 module; these tests must not be able "
        "to reach a terminal."
    )


# ----------------------------------------------------------
# HELPERS
# ----------------------------------------------------------

DEFAULT_FIELDS = [
    "name",
    "visible",
    "digits",
    "volume_min",
    "volume_max",
    "volume_step",
    "trade_contract_size",
    "trade_tick_size",
    "trade_tick_value",
    "currency_profit",
    "currency_margin",
    "currency_base",
    "trade_calc_mode",
]


def make_symbol_record(fields=None, **overrides):
    """
    A broker symbol record with the fields the bridge reads.

    A field left out of `fields` really is absent from the record, which is how
    the presence oracle is tested.
    """

    fields = DEFAULT_FIELDS if fields is None else fields

    values = {
        "name": "EURUSD",
        "visible": True,
        "digits": 5,
        "volume_min": 0.01,
        "volume_max": 100.0,
        "volume_step": 0.01,
        "trade_contract_size": 100000.0,
        "trade_tick_size": 0.00001,
        "trade_tick_value": 1.0,
        "currency_profit": "USD",
        "currency_margin": "EUR",
        "currency_base": "EUR",
        "trade_calc_mode": 0,
    }

    values.update(overrides)

    record = collections.namedtuple("SymbolInfo", fields)

    return record(
        **{
            key: value
            for key, value in values.items()
            if key in fields
        }
    )


class BridgeTestCase(unittest.TestCase):
    def setUp(self):
        self.stub = stub_mt5
        self.stub.symbol_records = {
            "EURUSD": make_symbol_record(),
        }
        self.stub.account_currency = "USD"
        self.stub.profit_results = []
        self.stub.symbol_info_calls = []
        self.stub.order_calc_profit_calls = []

        self._real_connection = app.ensure_mt5_connection

        app.ensure_mt5_connection = lambda: True

        self.client = app.app.test_client()

    def tearDown(self):
        app.ensure_mt5_connection = self._real_connection

    def set_grid(self, volume_min=0.01, volume_max=100.0, volume_step=0.01,
                 symbol="EURUSD", **extra):
        self.stub.symbol_records[symbol] = make_symbol_record(
            name=symbol,
            volume_min=volume_min,
            volume_max=volume_max,
            volume_step=volume_step,
            **extra,
        )


class DecimalConversionTests(BridgeTestCase):
    def test_accepts_real_numbers_and_numeric_strings(self):
        self.assertEqual(
            app.decimal_or_none(0.03),
            Decimal("0.03"),
        )

        self.assertEqual(
            app.decimal_or_none("1.5"),
            Decimal("1.5"),
        )

        self.assertEqual(
            app.decimal_or_none(2),
            Decimal("2.0"),
        )

        self.assertEqual(
            app.decimal_or_none(Decimal("0.25")),
            Decimal("0.25"),
        )

    def test_rejects_non_numbers(self):
        for value in (None, True, False, "", "   ", "abc", {}, [], object()):
            with self.subTest(value=value):
                self.assertIsNone(
                    app.decimal_or_none(value)
                )

    def test_rejects_non_finite(self):
        for value in (float("nan"), float("inf"), float("-inf"),
                      "NaN", "Infinity"):
            with self.subTest(value=value):
                self.assertIsNone(
                    app.decimal_or_none(value)
                )


class SymbolVolumeGridTests(BridgeTestCase):
    def test_returns_broker_grid_as_decimals(self):
        result = app.symbol_volume_grid("EURUSD")

        self.assertTrue(result["ok"])
        self.assertEqual(result["volume_min"], Decimal("0.01"))
        self.assertEqual(result["volume_max"], Decimal("100.0"))
        self.assertEqual(result["volume_step"], Decimal("0.01"))

    def test_unknown_symbol_is_refused(self):
        result = app.symbol_volume_grid("NOSUCH")

        self.assertFalse(result["ok"])
        self.assertEqual(result["code"], "SYMBOL_NOT_FOUND")

    def test_missing_field_is_refused_not_defaulted(self):
        self.stub.symbol_records["EURUSD"] = make_symbol_record(
            volume_step=None,
        )

        result = app.symbol_volume_grid("EURUSD")

        self.assertFalse(result["ok"])
        self.assertEqual(result["code"], "INVALID_VOLUME_SPEC")
        self.assertIn("volume_step", result["message"])

    def test_non_positive_grid_is_refused(self):
        for bad in (0, -0.01, None, "abc", float("nan")):
            with self.subTest(volume_step=bad):
                self.set_grid(volume_step=bad)

                result = app.symbol_volume_grid("EURUSD")

                self.assertFalse(result["ok"])
                self.assertEqual(result["code"], "INVALID_VOLUME_SPEC")

    def test_max_below_min_is_refused(self):
        self.set_grid(volume_min=1.0, volume_max=0.5)

        result = app.symbol_volume_grid("EURUSD")

        self.assertFalse(result["ok"])
        self.assertEqual(result["code"], "INVALID_VOLUME_SPEC")


class FloorVolumeTests(BridgeTestCase):
    def assert_floors(self, volume_min, volume_step, cases):
        min_d = Decimal(str(volume_min))
        step_d = Decimal(str(volume_step))

        for requested, expected in cases:
            with self.subTest(requested=requested):
                requested_d = Decimal(str(requested))

                result = app.floor_volume_to_grid(
                    requested_d,
                    min_d,
                    step_d,
                )

                expected_d = (
                    None
                    if expected is None
                    else Decimal(str(expected))
                )

                self.assertEqual(result, expected_d)

                if result is not None:
                    self.assertLessEqual(result, requested_d)
                    self.assertGreaterEqual(result, min_d)

    def test_001_step(self):
        self.assert_floors(
            0.01,
            0.01,
            [
                (0.01, 0.01),
                (0.02, 0.02),
                (0.03, 0.03),
                (0.015, 0.01),
                (0.019, 0.01),
                (0.0999, 0.09),
                (1.0, 1.0),
                (0.005, None),
                (0.0099, None),
            ],
        )

    def test_01_step(self):
        self.assert_floors(
            0.1,
            0.1,
            [
                (0.1, 0.1),
                (0.3, 0.3),
                (0.35, 0.3),
                (0.7, 0.7),
                (0.05, None),
            ],
        )

    def test_025_step(self):
        self.assert_floors(
            0.25,
            0.25,
            [
                (0.25, 0.25),
                (1.0, 1.0),
                (1.25, 1.25),
                (1.1, 1.0),
                (0.49, 0.25),
                (0.2, None),
            ],
        )

    def test_05_step(self):
        self.assert_floors(
            0.5,
            0.5,
            [
                (0.5, 0.5),
                (1.0, 1.0),
                (1.2, 1.0),
                (0.4, None),
            ],
        )

    def test_float_noise_snaps_to_the_intended_grid_value(self):
        # Stepping the broker grid in binary floats does not land on the grid:
        # ten 0.01 increments give 0.09999999999999999 and 0.01 * 35 gives
        # 0.35000000000000003. Refusing those would refuse a valid broker volume
        # over representation noise, and flooring the first one would silently
        # drop a whole step of volume the trader did ask for.
        ten_steps = 0.0

        for _ in range(10):
            ten_steps += 0.01

        self.assertNotEqual(ten_steps, 0.10)
        self.assertNotEqual(0.01 * 35, 0.35)
        self.assertNotEqual(0.1 * 3, 0.3)

        self.assertEqual(
            app.floor_volume_to_grid(
                app.decimal_or_none(ten_steps),
                Decimal("0.01"),
                Decimal("0.01"),
            ),
            Decimal("0.10"),
        )

        self.assertEqual(
            app.floor_volume_to_grid(
                app.decimal_or_none(0.01 * 35),
                Decimal("0.01"),
                Decimal("0.01"),
            ),
            Decimal("0.35"),
        )

        self.assertEqual(
            app.floor_volume_to_grid(
                app.decimal_or_none(0.1 * 3),
                Decimal("0.1"),
                Decimal("0.1"),
            ),
            Decimal("0.3"),
        )

        # Without the snap, the accumulated 0.09999999999999999 would floor to
        # 0.09, which is the silent one-step loss this guards against.
        self.assertEqual(
            app.floor_volume_to_grid(
                Decimal("0.09999999999999999"),
                Decimal("0.01"),
                Decimal("0.01"),
            ),
            Decimal("0.10"),
        )

    def test_never_rounds_up(self):
        min_d = Decimal("0.01")
        step_d = Decimal("0.01")

        for k in range(0, 200):
            requested = min_d + k * step_d + Decimal("0.004")

            result = app.floor_volume_to_grid(
                requested,
                min_d,
                step_d,
            )

            self.assertIsNotNone(result)
            self.assertLessEqual(result, requested)
            self.assertEqual(result, min_d + k * step_d)

    def test_grid_membership(self):
        self.assertTrue(
            app.is_volume_on_grid(
                Decimal("0.03"),
                Decimal("0.01"),
                Decimal("0.01"),
            )
        )

        self.assertFalse(
            app.is_volume_on_grid(
                Decimal("0.015"),
                Decimal("0.01"),
                Decimal("0.01"),
            )
        )

        # Below the minimum there is no grid index at all.
        self.assertFalse(
            app.is_volume_on_grid(
                Decimal("0.005"),
                Decimal("0.01"),
                Decimal("0.01"),
            )
        )


class NormalizeOpenVolumeTests(BridgeTestCase):
    def test_accepts_a_valid_grid_volume_unchanged(self):
        self.assertEqual(
            app.normalize_open_volume("EURUSD", 1.0),
            1.0,
        )

        self.assertEqual(
            app.normalize_open_volume("EURUSD", 0.03),
            0.03,
        )

    def test_floors_an_off_grid_volume(self):
        self.assertEqual(
            app.normalize_open_volume("EURUSD", 0.015),
            0.01,
        )

    def test_refuses_below_minimum_instead_of_raising_it(self):
        self.assertIsNone(
            app.normalize_open_volume("EURUSD", 0.005)
        )

    def test_refuses_above_maximum(self):
        self.assertIsNone(
            app.normalize_open_volume("EURUSD", 101.0)
        )

    def test_refuses_bad_input_and_unknown_symbol(self):
        for value in (None, 0, -1, "abc", float("nan"), True):
            with self.subTest(volume=value):
                self.assertIsNone(
                    app.normalize_open_volume("EURUSD", value)
                )

        self.assertIsNone(
            app.normalize_open_volume("NOSUCH", 1.0)
        )

    def test_refuses_when_the_broker_has_no_usable_grid(self):
        self.stub.symbol_records["EURUSD"] = make_symbol_record(
            volume_step=0,
        )

        self.assertIsNone(
            app.normalize_open_volume("EURUSD", 1.0)
        )


class ReconcileVolumeTests(BridgeTestCase):
    def test_exact_equal_values_reconcile(self):
        self.assertTrue(
            app.reconcile_requested_volume(
                Decimal("0.3"),
                Decimal("0.3"),
            )
        )

    def test_real_differences_are_rejected(self):
        for requested, normalized in (
            ("0.03", "0.04"),
            ("0.3", "0.31"),
            ("1.0", "0.99"),
            ("0.01", "0.015"),
        ):
            with self.subTest(requested=requested):
                self.assertFalse(
                    app.reconcile_requested_volume(
                        Decimal(requested),
                        Decimal(normalized),
                    )
                )

    def test_float_noise_is_not_reported_as_a_change(self):
        self.assertTrue(
            app.reconcile_requested_volume(
                app.decimal_or_none(0.1 * 3),
                0.3,
                Decimal("0.1"),
                Decimal("0.1"),
            )
        )

    def test_noise_does_not_hide_a_one_step_change(self):
        self.assertFalse(
            app.reconcile_requested_volume(
                app.decimal_or_none(0.1 * 3),
                0.4,
                Decimal("0.1"),
                Decimal("0.1"),
            )
        )

    def test_without_a_grid_only_exact_equality_reconciles(self):
        self.assertFalse(
            app.reconcile_requested_volume(
                app.decimal_or_none(0.1 * 3),
                0.3,
            )
        )

    def test_unusable_inputs_reconcile_to_false(self):
        for requested, normalized in (
            (None, "0.03"),
            ("0.03", None),
            ("abc", "0.03"),
            (True, 1.0),
        ):
            with self.subTest(requested=requested):
                self.assertFalse(
                    app.reconcile_requested_volume(
                        requested,
                        normalized,
                    )
                )


class ValidateRequestedVolumeTests(BridgeTestCase):
    def test_valid_volume_is_returned_unchanged(self):
        result = app.validate_requested_open_volume("EURUSD", 0.03)

        self.assertTrue(result["ok"])
        self.assertEqual(result["code"], "OK")
        self.assertEqual(result["volume"], 0.03)

    def test_broker_noise_volume_is_accepted_not_refused(self):
        result = app.validate_requested_open_volume(
            "EURUSD",
            0.01 * 35,
        )

        self.assertTrue(result["ok"])
        self.assertEqual(result["volume"], 0.35)

    def test_invalid_volume(self):
        for value in (None, 0, -0.01, "abc", float("nan"), True):
            with self.subTest(volume=value):
                result = app.validate_requested_open_volume(
                    "EURUSD",
                    value,
                )

                self.assertFalse(result["ok"])
                self.assertEqual(result["code"], "INVALID_VOLUME")

    def test_symbol_not_found(self):
        result = app.validate_requested_open_volume("NOSUCH", 1.0)

        self.assertFalse(result["ok"])
        self.assertEqual(result["code"], "SYMBOL_NOT_FOUND")

    def test_invalid_volume_spec(self):
        self.stub.symbol_records["EURUSD"] = make_symbol_record(
            volume_min=None,
        )

        result = app.validate_requested_open_volume("EURUSD", 1.0)

        self.assertFalse(result["ok"])
        self.assertEqual(result["code"], "INVALID_VOLUME_SPEC")

    def test_below_broker_minimum_is_never_raised(self):
        result = app.validate_requested_open_volume("EURUSD", 0.005)

        self.assertFalse(result["ok"])
        self.assertEqual(result["code"], "BELOW_BROKER_MINIMUM")
        self.assertNotIn("volume", result)
        self.assertIn("was not raised", result["message"])

    def test_above_broker_maximum(self):
        result = app.validate_requested_open_volume("EURUSD", 150.0)

        self.assertFalse(result["ok"])
        self.assertEqual(result["code"], "ABOVE_BROKER_MAXIMUM")
        self.assertNotIn("volume", result)

    def test_off_grid_is_refused_with_a_suggestion(self):
        result = app.validate_requested_open_volume("EURUSD", 0.015)

        self.assertFalse(result["ok"])
        self.assertEqual(result["code"], "OFF_GRID_VOLUME")
        self.assertNotIn("volume", result)
        self.assertEqual(result["nearest_valid_volume"], 0.01)

    def test_grid_details_are_reported_back(self):
        self.set_grid(volume_min=0.5, volume_max=50.0, volume_step=0.5)

        result = app.validate_requested_open_volume("EURUSD", 1.0)

        self.assertTrue(result["ok"])
        self.assertEqual(result["volume_min"], 0.5)
        self.assertEqual(result["volume_max"], 50.0)
        self.assertEqual(result["volume_step"], 0.5)

    def test_error_payload_shape(self):
        validation = app.validate_requested_open_volume(
            "EURUSD",
            0.015,
        )

        payload = app.volume_error_payload("EURUSD", validation)

        self.assertFalse(payload["success"])
        self.assertEqual(payload["error"], "OFF_GRID_VOLUME")
        self.assertEqual(payload["symbol"], "EURUSD")
        self.assertEqual(payload["requested_volume"], 0.015)
        self.assertEqual(payload["volume_min"], 0.01)
        self.assertEqual(payload["volume_step"], 0.01)


class SpecFieldStatusTests(BridgeTestCase):
    def test_classifies_without_repairing(self):
        # A list, not a dict: True, 1 and 1.0 are the same dict key.
        cases = [
            (1.0, "ok"),
            (0.01, "ok"),
            (7, "ok"),
            (0.0, "non_positive"),
            (-1.0, "non_positive"),
            (float("nan"), "non_finite"),
            (float("inf"), "non_finite"),
            (None, "missing"),
            ("", "missing"),
            ("  ", "missing"),
            ("1.0", "not_a_number"),
            (True, "not_a_number"),
        ]

        for value, expected in cases:
            with self.subTest(value=value):
                self.assertEqual(
                    app.spec_field_status(value),
                    expected,
                )


class SymbolInfoRouteTests(BridgeTestCase):
    def test_get_only(self):
        response = self.client.post("/mt5/symbol-info")

        self.assertEqual(response.status_code, 405)

    def test_not_connected(self):
        app.ensure_mt5_connection = lambda: False

        response = self.client.get(
            "/mt5/symbol-info?symbol=EURUSD"
        )

        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.get_json()["connected"])

    def test_missing_symbol(self):
        response = self.client.get("/mt5/symbol-info")

        self.assertEqual(response.status_code, 400)

    def test_unknown_symbol(self):
        response = self.client.get(
            "/mt5/symbol-info?symbol=NOSUCH"
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.get_json()["success"])

    def test_returns_reported_fields(self):
        response = self.client.get(
            "/mt5/symbol-info?symbol=eurusd"
        )

        self.assertEqual(response.status_code, 200)

        data = response.get_json()

        self.assertTrue(data["success"])
        self.assertEqual(data["symbol"], "EURUSD")
        self.assertTrue(data["volume_grid_usable"])
        self.assertEqual(data["digits"], 5)
        self.assertEqual(data["spec"]["volume_min"], 0.01)
        self.assertEqual(
            data["spec"]["trade_contract_size"],
            100000.0,
        )
        self.assertEqual(data["spec"]["currency_profit"], "USD")
        self.assertEqual(data["spec_status"]["volume_step"], "ok")
        self.assertIn("volume_min", data["fields_present"])

    def test_absent_field_is_reported_missing_not_invented(self):
        # trade_tick_value_loss and currency_profit are not in this record at
        # all, exactly as on a broker that does not publish them.
        self.stub.symbol_records["EURUSD"] = make_symbol_record(
            fields=[
                name
                for name in DEFAULT_FIELDS
                if name not in (
                    "trade_tick_value_loss",
                    "currency_profit",
                )
            ],
        )

        response = self.client.get(
            "/mt5/symbol-info?symbol=EURUSD"
        )

        self.assertEqual(response.status_code, 200)

        data = response.get_json()

        self.assertNotIn(
            "trade_tick_value_loss",
            data["fields_present"],
        )
        self.assertIsNone(data["spec"]["trade_tick_value_loss"])
        self.assertEqual(
            data["spec_status"]["trade_tick_value_loss"],
            "missing",
        )
        self.assertIsNone(data["spec"]["currency_profit"])

    def test_unusable_grid_is_flagged(self):
        self.set_grid(volume_step=0.0)

        response = self.client.get(
            "/mt5/symbol-info?symbol=EURUSD"
        )

        self.assertEqual(response.status_code, 200)

        data = response.get_json()

        self.assertFalse(data["volume_grid_usable"])
        self.assertEqual(
            data["spec_status"]["volume_step"],
            "non_positive",
        )
        self.assertIsNone(data["spec"]["volume_step"])


class CalcProfitRouteTests(BridgeTestCase):
    QUERY = (
        "/mt5/calc-profit?symbol=EURUSD&action=BUY"
        "&volume=1&price_open=1.1&price_close=1.2"
    )

    def test_get_only(self):
        response = self.client.post("/mt5/calc-profit")

        self.assertEqual(response.status_code, 405)

    def test_not_connected(self):
        app.ensure_mt5_connection = lambda: False

        response = self.client.get(self.QUERY)

        self.assertEqual(response.status_code, 503)

    def test_missing_symbol(self):
        response = self.client.get("/mt5/calc-profit")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json()["error"],
            "MISSING_SYMBOL",
        )

    def test_invalid_action(self):
        response = self.client.get(
            self.QUERY.replace("action=BUY", "action=HOLD")
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json()["error"],
            "INVALID_ACTION",
        )

    def test_invalid_volume(self):
        for volume in ("", "abc", "0", "-1", "NaN"):
            with self.subTest(volume=volume):
                response = self.client.get(
                    self.QUERY.replace(
                        "volume=1",
                        f"volume={volume}",
                    )
                )

                self.assertEqual(response.status_code, 400)
                self.assertEqual(
                    response.get_json()["error"],
                    "INVALID_VOLUME",
                )

    def test_invalid_price(self):
        cases = [
            "price_open=abc&price_close=1.2",
            "price_open=1.1",
            "price_open=-1.1&price_close=1.2",
            "price_open=1.1&price_close=1.1",
        ]

        for case in cases:
            with self.subTest(case=case):
                response = self.client.get(
                    "/mt5/calc-profit?symbol=EURUSD&action=BUY"
                    f"&volume=1&{case}"
                )

                self.assertEqual(response.status_code, 400)
                self.assertEqual(
                    response.get_json()["error"],
                    "INVALID_PRICE",
                )

    def test_a_volume_the_order_path_would_refuse_is_not_measured(self):
        for volume, expected in (
            ("0.015", "OFF_GRID_VOLUME"),
            ("0.005", "BELOW_BROKER_MINIMUM"),
            ("150.0", "ABOVE_BROKER_MAXIMUM"),
        ):
            with self.subTest(volume=volume):
                response = self.client.get(
                    self.QUERY.replace(
                        "volume=1",
                        f"volume={volume}",
                    )
                )

                self.assertEqual(response.status_code, 400)
                self.assertEqual(
                    response.get_json()["error"],
                    expected,
                )

        self.assertEqual(
            self.stub.order_calc_profit_calls,
            [],
        )

    def test_unknown_symbol_is_refused_before_any_calculation(self):
        response = self.client.get(
            self.QUERY.replace("symbol=EURUSD", "symbol=NOSUCH")
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json()["error"],
            "SYMBOL_NOT_FOUND",
        )

    def test_broker_none_blocks(self):
        self.stub.profit_results = [None]

        response = self.client.get(self.QUERY)

        self.assertEqual(response.status_code, 502)

        data = response.get_json()

        self.assertEqual(
            data["error"],
            "BROKER_RISK_UNAVAILABLE",
        )
        self.assertIn("error_detail", data)

    def test_non_finite_broker_result_blocks(self):
        for bad in (float("nan"), float("inf")):
            with self.subTest(bad=bad):
                self.stub.profit_results = [bad]

                response = self.client.get(self.QUERY)

                self.assertEqual(response.status_code, 502)
                self.assertEqual(
                    response.get_json()["error"],
                    "BROKER_RISK_INVALID",
                )

    def test_unreadable_account_currency_blocks(self):
        self.stub.profit_results = [-10.0]
        self.stub.account_currency = ""

        response = self.client.get(self.QUERY)

        self.assertEqual(response.status_code, 502)
        self.assertEqual(
            response.get_json()["error"],
            "ACCOUNT_CURRENCY_UNAVAILABLE",
        )

    def test_zero_for_a_non_zero_price_move_blocks(self):
        self.stub.profit_results = [0.0]

        response = self.client.get(self.QUERY)

        self.assertEqual(response.status_code, 422)
        self.assertEqual(
            response.get_json()["error"],
            "ZERO_RISK_RESPONSE",
        )

    def test_successful_loss_measurement(self):
        self.stub.profit_results = [-981.0]

        response = self.client.get(
            "/mt5/calc-profit?symbol=EURUSD&action=BUY"
            "&volume=3.27&price_open=1.11758&price_close=1.11458"
        )

        self.assertEqual(response.status_code, 200)

        data = response.get_json()

        self.assertTrue(data["success"])
        self.assertEqual(data["profit"], -981.0)
        self.assertEqual(data["loss_abs"], 981.0)
        self.assertEqual(data["account_currency"], "USD")
        self.assertEqual(
            data["calculation"],
            "mt5.order_calc_profit",
        )
        self.assertEqual(
            data["currency_source"],
            "account_info().currency",
        )
        self.assertEqual(data["volume"], 3.27)
        self.assertEqual(data["volume_step"], 0.01)

        self.assertEqual(
            self.stub.order_calc_profit_calls,
            [
                {
                    "action": self.stub.ORDER_TYPE_BUY,
                    "symbol": "EURUSD",
                    "volume": 3.27,
                    "price_open": 1.11758,
                    "price_close": 1.11458,
                },
            ],
        )

    def test_sell_action_is_passed_through(self):
        self.stub.profit_results = [-1.0]

        self.client.get(
            self.QUERY.replace("action=BUY", "action=SELL")
        )

        self.assertEqual(
            self.stub.order_calc_profit_calls[0]["action"],
            self.stub.ORDER_TYPE_SELL,
        )

    def test_broker_exception_becomes_a_refusal(self):
        self.stub.profit_results = ["raise"]

        response = self.client.get(self.QUERY)

        self.assertEqual(response.status_code, 500)
        self.assertFalse(response.get_json()["success"])


class ReadOnlyGuaranteeTests(BridgeTestCase):
    CALC_PROFIT_BANNED = [
        "order_send",
        "order_check",
        "order_send_async",
        "positions_close",
        "trade_transaction",
        "trade_tick_value",
        "trade_contract_size",
    ]

    def test_calc_profit_source_never_touches_an_order_api(self):
        source = inspect.getsource(app.mt5_calc_profit)

        for token in self.CALC_PROFIT_BANNED:
            with self.subTest(token=token):
                self.assertNotIn(token, source)

    def test_symbol_info_reports_metadata_but_calculates_nothing(self):
        source = inspect.getsource(app.mt5_symbol_info)

        for token in (
            "order_send",
            "order_check",
            "positions_close",
            "order_calc_profit",
        ):
            with self.subTest(token=token):
                self.assertNotIn(token, source)

    def test_new_routes_are_get_only(self):
        rules = [
            rule
            for rule in app.app.url_map.iter_rules()
            if rule.rule in ("/mt5/calc-profit", "/mt5/symbol-info")
        ]

        self.assertEqual(len(rules), 2)

        for rule in rules:
            with self.subTest(rule=rule.rule):
                self.assertEqual(
                    rule.methods & {
                        "POST",
                        "PUT",
                        "PATCH",
                        "DELETE",
                    },
                    set(),
                )

    def test_market_order_refuses_an_off_grid_volume(self):
        # The stub raises if any order function is reached, so getting a 400
        # back proves the volume was refused before anything was sent.
        response = self.client.post(
            "/mt5/order",
            json={
                "symbol": "EURUSD",
                "side": "BUY",
                "lots": 0.015,
            },
        )

        self.assertEqual(response.status_code, 400)

        data = response.get_json()

        self.assertFalse(data["success"])
        self.assertEqual(data["error"], "OFF_GRID_VOLUME")
        self.assertEqual(data["requested_volume"], 0.015)
        self.assertEqual(data["volume_step"], 0.01)

    def test_market_order_refuses_a_sub_minimum_volume(self):
        response = self.client.post(
            "/mt5/order",
            json={
                "symbol": "EURUSD",
                "side": "SELL",
                "lots": 0.005,
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json()["error"],
            "BELOW_BROKER_MINIMUM",
        )

    def test_pending_order_refuses_an_off_grid_volume(self):
        response = self.client.post(
            "/mt5/pending-order",
            json={
                "symbol": "EURUSD",
                "side": "BUY",
                "orderType": "BUY_LIMIT",
                "lots": 0.005,
                "entry": 1.1,
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json()["error"],
            "BELOW_BROKER_MINIMUM",
        )


if __name__ == "__main__":
    unittest.main()
