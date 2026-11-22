import collections
import contextlib
from datetime import datetime, timezone
import importlib.util
import io
from pathlib import Path
import socket
import sys
import threading
import unittest
from unittest.mock import patch


class StubMT5:
    def __init__(self):
        self.reset()
        self.constants = {}

    def reset(self):
        self.account = {"login": 123456, "server": "Broker-Demo", "currency": "USD"}
        self.terminal = {"name": "isolated fixture"}
        self.deals = []
        self.positions = []
        self.history_calls = []
        self.mutations = []
        self.history_hook = None
        self.positions_hook = None
        self.initialize_success = True
        self.account_hook = None

    def account_info(self):
        if self.account_hook:
            return self.account_hook()
        if self.account is None:
            return None
        return collections.namedtuple("Account", self.account)(**self.account)

    def terminal_info(self):
        return self.terminal

    def history_deals_get(self, date_from, date_to):
        self.history_calls.append((date_from, date_to))
        if self.history_hook:
            self.history_hook()
        return self.deals

    def positions_get(self):
        if self.positions_hook:
            self.positions_hook()
        return self.positions

    def initialize(self, **kwargs):
        self.mutations.append(("initialize", kwargs))
        if not self.initialize_success:
            return False
        self.terminal = {"name": "isolated fixture"}
        self.account = {
            "login": kwargs.get("login", 123456),
            "server": kwargs.get("server", "Broker-Demo"),
            "currency": "USD",
        }
        return True

    def shutdown(self):
        self.mutations.append(("shutdown", {}))
        self.terminal = None
        self.account = None

    def last_error(self):
        return (1, "isolated read failure")

    def __getattr__(self, name):
        # The import machinery probes module dunders (__spec__, __path__,
        # __name__, ...). Those are not MT5 calls; let normal attribute
        # resolution proceed instead of failing the suite.
        if name.startswith("__") and name.endswith("__"):
            raise AttributeError(name)
        if name.isupper():
            return self.constants.setdefault(name, len(self.constants) + 1000)
        raise AssertionError(f"MT5 call {name} is forbidden in this suite")


STUB = StubMT5()
MODULE_SPEC = importlib.util.spec_from_file_location(
    "isolated_history_bridge", Path(__file__).with_name("app.py")
)
BRIDGE = importlib.util.module_from_spec(MODULE_SPEC)
with patch.dict(sys.modules, {"MetaTrader5": STUB}):
    MODULE_SPEC.loader.exec_module(BRIDGE)
if BRIDGE.mt5 is not STUB:
    raise RuntimeError("The isolated bridge must bind only the MT5 replacement")


def deal(**overrides):
    fields = {
        "ticket": 9007199254740993, "order": 9007199254740994,
        "position_id": 9007199254740995, "symbol": "EURUSD", "type": 1,
        "entry": 1, "volume": 0.3, "price": 1.1, "profit": -12.5,
        "commission": -0.5, "swap": -0.1, "fee": -0.2,
        "time": 1767225600, "time_msc": 1767225600123,
        "comment": "fixture", "magic": 2026001,
    }
    fields.update(overrides)
    return collections.namedtuple("Deal", fields)(**fields)


def position(**overrides):
    fields = {
        "ticket": 7001, "identifier": 6001, "symbol": "EURUSD",
        "type": 0, "volume": 0.2, "price_open": 1.2, "price_current": 1.1,
        "sl": 1.0, "tp": 1.4, "profit": -2.0, "swap": 0.0,
        "time": 1767225600, "time_msc": 1767225600000,
    }
    fields.update(overrides)
    return collections.namedtuple("Position", fields)(**fields)


BASE_QUERY = {
    "expected_mt5_login": "123456", "expected_mt5_server": "Broker-Demo",
    "from_utc": "2026-01-01T00:00:00Z", "to_utc": "2026-01-02T00:00:00Z",
}


class HistoryContractTests(unittest.TestCase):
    def setUp(self):
        STUB.reset()
        self.network_guard = patch.object(
            socket.socket, "connect", side_effect=AssertionError("Network is forbidden")
        )
        self.network_guard.start()
        self.addCleanup(self.network_guard.stop)
        self.stdout_guard = contextlib.redirect_stdout(io.StringIO())
        self.stdout_guard.__enter__()
        self.addCleanup(self.stdout_guard.__exit__, None, None, None)

    def request(self, overrides=None, remove=()):
        query = {**BASE_QUERY, **(overrides or {})}
        for key in remove:
            query.pop(key, None)
        return self.raw_request(query)

    def raw_request(self, query):
        with BRIDGE.app.test_request_context("/mt5/history", query_string=query):
            response = BRIDGE.app.make_response(BRIDGE.mt5_history())
            return response.status_code, response.get_json()

    def assert_failure(self, status, body, expected_status, code):
        self.assertEqual(status, expected_status)
        self.assertFalse(body["success"])
        self.assertFalse(body["page_query_complete"])
        self.assertIsNone(body["history"])
        self.assertEqual(body["code"], code)

    def test_missing_identity_is_rejected_before_broker_reads(self):
        for key in ("expected_mt5_login", "expected_mt5_server"):
            with self.subTest(key=key):
                status, body = self.request(remove=(key,))
                self.assert_failure(status, body, 400, "INVALID_HISTORY_QUERY")
        self.assertEqual(STUB.history_calls, [])
        self.assertEqual(STUB.mutations, [])

    def test_invalid_identity_does_not_fall_back_to_account_id(self):
        for identity in ("", "0", "-1", "1.0", "True", "123x"):
            with self.subTest(identity=identity):
                status, body = self.request({"expected_mt5_login": identity})
                self.assert_failure(status, body, 400, "INVALID_HISTORY_QUERY")
        status, body = self.request({"expected_mt5_server": "  "})
        self.assert_failure(status, body, 400, "INVALID_HISTORY_QUERY")
        status, body = self.request({"accountId": "123456"}, remove=("expected_mt5_login",))
        self.assert_failure(status, body, 400, "INVALID_HISTORY_QUERY")

    def test_both_connected_identity_fields_are_required(self):
        for field, value in (("login", None), ("server", None), ("server", "")):
            with self.subTest(field=field, value=value):
                STUB.reset()
                STUB.account[field] = value
                status, body = self.request()
                self.assert_failure(status, body, 503, "MT5_IDENTITY_UNAVAILABLE")
        self.assertEqual(STUB.history_calls, [])

    def test_login_and_server_mismatch_are_rejected(self):
        for query in ({"expected_mt5_login": "654321"}, {"expected_mt5_server": "Other-Demo"}):
            status, body = self.request(query)
            self.assert_failure(status, body, 409, "MT5_IDENTITY_MISMATCH")
        self.assertEqual(STUB.history_calls, [])

    def test_broker_login_that_is_not_ascii_digits_is_refused(self):
        """
        The connected identity is a boundary, not a hint.

        A broker value that cannot be read as an ASCII login number is reported
        as unavailable: it is never coerced into a login and never raised out of
        the request as an HTML error page.
        """

        for value in (0, -1, 1.5, "123x", "\u0661\u0662\u0663", "\u00b2", True):
            with self.subTest(value=value):
                STUB.reset()
                STUB.account["login"] = value
                status, body = self.request()
                self.assert_failure(status, body, 503, "MT5_IDENTITY_UNAVAILABLE")
        self.assertEqual(STUB.history_calls, [])

    def test_identity_normalization_preserves_confirmed_identity(self):
        status, body = self.request({
            "expected_mt5_login": "000123456", "expected_mt5_server": " broker-DEMO "
        })
        self.assertEqual(status, 200)
        self.assertEqual(body["identity"], {"mt5Login": "123456", "mt5Server": "broker-demo"})

    def test_disconnection_never_initializes_or_switches(self):
        for field in ("account", "terminal"):
            STUB.reset()
            setattr(STUB, field, None)
            status, body = self.request()
            self.assert_failure(status, body, 503, "MT5_NOT_CONNECTED")
            self.assertEqual(STUB.mutations, [])
            self.assertEqual(STUB.history_calls, [])

    def test_verified_empty_result_has_identity_and_explicit_coverage(self):
        status, body = self.request()
        self.assertEqual(status, 200)
        self.assertTrue(body["success"])
        self.assertTrue(body["page_query_complete"])
        self.assertFalse(body["source_scan_complete"])
        self.assertEqual(body["history"], [])
        self.assertEqual(body["positions"], [])
        self.assertEqual(body["count"], 0)
        self.assertEqual(body["utc_range"], {
            "from_utc": "2026-01-01T00:00:00Z", "to_utc": "2026-01-02T00:00:00Z"
        })
        self.assertEqual(body["coverage"]["returned_deal_count"], 0)
        self.assertEqual(body["coverage"]["serialized_deal_count"], 0)
        self.assertEqual(body["coverage"]["boundaries"], "inclusive")
        self.assertEqual(body["retention_verified"], False)
        self.assertTrue(body["bridge_boot_id"])
        self.assertIsInstance(body["connection_generation"], int)
        self.assertEqual(STUB.history_calls, [(
            datetime(2026, 1, 1, tzinfo=timezone.utc),
            datetime(2026, 1, 2, tzinfo=timezone.utc),
        )])

    def test_none_history_is_failure_not_empty(self):
        STUB.deals = None
        status, body = self.request()
        self.assert_failure(status, body, 503, "MT5_HISTORY_READ_FAILED")

    def test_none_positions_is_incomplete_not_closed(self):
        STUB.positions = None
        status, body = self.request()
        self.assert_failure(status, body, 503, "MT5_POSITIONS_READ_FAILED")

    def test_non_collection_history_is_rejected(self):
        for value in ({"ticket": 1}, "bad", 42):
            STUB.deals = value
            status, body = self.request()
            self.assert_failure(status, body, 502, "MALFORMED_HISTORY")

    def test_deal_ids_are_exact_strings_and_volume_is_decimal(self):
        STUB.deals = [deal()]
        STUB.positions = [position()]
        status, body = self.request()
        self.assertEqual(status, 200)
        row = body["history"][0]
        self.assertEqual(row["ticket"], "9007199254740993")
        self.assertEqual(row["order"], "9007199254740994")
        self.assertEqual(row["position_id"], "9007199254740995")
        self.assertEqual(row["volume"], "0.3")
        self.assertEqual(row["raw"]["ticket"], "9007199254740993")
        live = body["positions"][0]
        self.assertEqual(live["ticket"], "7001")
        self.assertEqual(live["position_id"], "6001")
        self.assertEqual(live["identifier"], "6001")
        self.assertEqual(live["volume"], "0.2")

    def test_missing_required_fields_fail_entire_history_batch(self):
        for field in ("ticket", "position_id", "entry", "profit", "commission", "swap", "fee", "time_msc"):
            fields = deal()._asdict()
            fields.pop(field)
            STUB.deals = [deal(ticket=7), fields]
            status, body = self.request()
            self.assert_failure(status, body, 502, "MALFORMED_HISTORY")

    def test_invalid_fields_are_not_repaired(self):
        for overrides in (
            {"ticket": 1.5}, {"ticket": True}, {"position_id": 0},
            {"symbol": ""}, {"volume": 0}, {"volume": float("nan")},
            {"profit": float("inf")}, {"price": -1}, {"entry": -1},
            {"time_msc": 1767225601123},
        ):
            with self.subTest(overrides=overrides):
                STUB.deals = [deal(**overrides)]
                status, body = self.request()
                self.assert_failure(status, body, 502, "MALFORMED_HISTORY")

    def test_financial_non_position_deal_preserves_zero_identifiers(self):
        STUB.deals = [deal(type=2, position_id=0, order=0, volume=0, price=0, symbol="")]
        status, body = self.request()
        self.assertEqual(status, 200)
        self.assertEqual(body["history"][0]["position_id"], "0")

    def test_unsupported_lifecycle_is_preserved_not_reconciled(self):
        STUB.deals = [deal(entry=2)]
        status, body = self.request()
        self.assertEqual(status, 200)
        self.assertEqual(body["history"][0]["entry"], 2)

    def test_serialization_failure_never_skips_a_record(self):
        class BrokenRecord:
            def _asdict(self):
                raise ValueError("cannot serialize fixture")
        STUB.deals = [deal(), BrokenRecord()]
        status, body = self.request()
        self.assert_failure(status, body, 502, "MALFORMED_HISTORY")

    def test_unserializable_raw_fields_reject_the_batch(self):
        fields = deal()._asdict()
        fields["opaque"] = object()
        STUB.deals = [fields]
        status, body = self.request()
        self.assert_failure(status, body, 502, "MALFORMED_HISTORY")

    def test_duplicate_ticket_conflict_is_rejected(self):
        STUB.deals = [deal(), deal(profit=123)]
        status, body = self.request()
        self.assert_failure(status, body, 502, "MALFORMED_HISTORY")

    def test_identical_duplicate_deals_are_reported_without_discarding(self):
        STUB.deals = [deal(), deal()]
        status, body = self.request()
        self.assertEqual(status, 200)
        self.assertEqual(body["count"], 2)
        self.assertEqual(body["coverage"]["returned_deal_count"], 2)

    def test_position_identifier_is_required_and_separate_from_ticket(self):
        fields = position()._asdict()
        fields.pop("identifier")
        STUB.positions = [fields]
        status, body = self.request()
        self.assert_failure(status, body, 502, "MALFORMED_POSITIONS")

    def test_invalid_or_duplicate_live_positions_are_rejected(self):
        for positions in (
            "bad", [position(volume=0)], [position(identifier=0)],
            [position(), position(ticket=7002)],
        ):
            STUB.positions = positions
            status, body = self.request()
            self.assert_failure(status, body, 502, "MALFORMED_POSITIONS")

    def test_external_identity_changes_during_each_read_are_rejected(self):
        for hook in ("history_hook", "positions_hook"):
            STUB.reset()
            setattr(STUB, hook, lambda: STUB.account.update(server="Other-Demo"))
            status, body = self.request()
            self.assert_failure(status, body, 409, "MT5_IDENTITY_MISMATCH")

    def test_invalid_utc_ranges_are_rejected_without_queries(self):
        for override in (
            {"from_utc": "2026-01-01T00:00:00"},
            {"from_utc": "2026-01-01T00:00:00+05:30"},
            {"from_utc": "invalid"}, {"to_utc": "2025-12-31T00:00:00Z"},
            {"to_utc": "2026-01-02T00:00:00.000001Z"},
            {"from_utc": "1969-12-31T00:00:00Z"},
            {"to_utc": "2999-01-01T00:00:00Z"},
        ):
            status, body = self.request(override)
            self.assert_failure(status, body, 400, "INVALID_HISTORY_QUERY")
        self.assertEqual(STUB.history_calls, [])

    def test_missing_or_repeated_query_fields_are_rejected(self):
        for field in ("from_utc", "to_utc"):
            status, body = self.request(remove=(field,))
            self.assert_failure(status, body, 400, "INVALID_HISTORY_QUERY")
        query = list(BASE_QUERY.items()) + [("expected_mt5_login", "654321")]
        status, body = self.raw_request(query)
        self.assert_failure(status, body, 400, "INVALID_HISTORY_QUERY")

    def test_oversized_page_is_rejected_not_truncated(self):
        status, body = self.request({"to_utc": "2027-01-02T00:00:00Z"})
        self.assert_failure(status, body, 400, "INVALID_HISTORY_QUERY")
        self.assertEqual(STUB.history_calls, [])

    def test_full_scan_range_is_echoed_without_retention_claim(self):
        status, body = self.request({
            "from_utc": "1970-01-01T00:00:00Z", "to_utc": "1971-01-01T00:00:00Z",
            "scan_from_utc": "1970-01-01T00:00:00Z", "scan_to_utc": "2026-01-02T00:00:00Z",
        })
        self.assertEqual(status, 200)
        self.assertEqual(body["scan_range"], {
            "from_utc": "1970-01-01T00:00:00Z", "to_utc": "2026-01-02T00:00:00Z"
        })
        self.assertFalse(body["source_scan_complete"])

    def test_inclusive_page_boundaries_preserve_all_deals(self):
        STUB.deals = [deal(time_msc=1767225600000), deal(
            ticket=5, time=1767312000, time_msc=1767312000000
        )]
        status, body = self.request()
        self.assertEqual(status, 200)
        self.assertEqual(body["count"], 2)

    def test_out_of_range_deal_is_not_silently_discarded(self):
        STUB.deals = [deal(time=1767312001, time_msc=1767312001000)]
        status, body = self.request()
        self.assert_failure(status, body, 502, "MALFORMED_HISTORY")

    def test_non_position_financial_deal_types_are_kept_as_evidence(self):
        """
        Deposits, credits and currency deals are real broker records.

        They must not fail the page, and they must not look like position
        volume: they carry no position and no tradable volume.
        """

        for deal_type in (2, 3, 4, 5):
            with self.subTest(deal_type=deal_type):
                STUB.reset()
                STUB.deals = [
                    deal(),
                    deal(
                        ticket=8000 + deal_type,
                        type=deal_type,
                        position_id=0,
                        order=0,
                        volume=0,
                        price=0,
                        symbol="",
                        profit=25.0,
                    ),
                ]
                status, body = self.request()
                self.assertEqual(status, 200)
                self.assertEqual(body["count"], 2)
                self.assertEqual(body["coverage"]["serialized_deal_count"], 2)
                financial = body["history"][1]
                self.assertEqual(financial["type"], deal_type)
                self.assertEqual(financial["position_id"], "0")
                self.assertEqual(financial["volume"], "0")
                self.assertEqual(financial["profit"], "25")

    def test_unrecognised_deal_type_fails_the_page_closed(self):
        for value in (6, 99, -1, "2", None, 1.0, True):
            with self.subTest(value=value):
                STUB.reset()
                STUB.deals = [deal(type=value)]
                status, body = self.request()
                self.assert_failure(status, body, 502, "MALFORMED_HISTORY")

    def test_non_ascii_digits_are_not_accepted_as_numbers(self):
        """
        str.isdigit() accepts Arabic-Indic digits and '²'.

        The first would silently match a real login, the second would raise
        out of int() and answer with an HTML 500 instead of the JSON contract.
        """

        for login in ("\u0661\u0662\u0663", "\u0661\u0662\u0663\u0664\u0665\u0666", "\u00b2", "1_0", "1 2", "\u0661\u0662\u0663\u0664\u0665\u0666".replace("\u0661", "1")):
            with self.subTest(login=login):
                status, body = self.request({"expected_mt5_login": login})
                self.assert_failure(status, body, 400, "INVALID_HISTORY_QUERY")
        self.assertEqual(STUB.history_calls, [])
        self.assertEqual(STUB.mutations, [])

    def test_invalid_connection_generation_is_a_json_refusal(self):
        _, initial = self.request()
        for generation in ("-1", "\u0661", "\u00b2", "1_0", "", " 1"):
            with self.subTest(generation=generation):
                status, body = self.request({
                    "bridge_boot_id": initial["bridge_boot_id"],
                    "connection_generation": generation,
                })
                self.assert_failure(status, body, 400, "INVALID_HISTORY_QUERY")

    def test_connection_mutation_during_a_native_read_invalidates_the_page(self):
        """
        A scan must never be stitched across a connection mutation.

        The mutation happens inside the history read, so it cannot overlap the
        native call itself; landing it between two guarded steps must strand
        the page through the connection generation.
        """

        def mutate_connection():
            BRIDGE.initialize_mt5()

        STUB.history_hook = mutate_connection
        status, body = self.request()
        self.assert_failure(status, body, 409, "MT5_CONNECTION_CHANGED")
        self.assertEqual(STUB.mutations, [("initialize", {})])

    def test_the_lock_is_free_while_a_page_is_being_serialized(self):
        """
        Validating and serializing a page must not occupy the connection lock.

        Another MT5 endpoint asks for the lock exactly while this page is being
        serialized. Only a scan that keeps the lock to its native calls can
        answer it; a scan that holds it across the whole page makes every
        trading endpoint wait for the page instead of for one read.
        """

        acquired = threading.Event()
        original = BRIDGE.collect_history_page

        def competitor():
            if BRIDGE.MT5_CONNECTION_LOCK.acquire(blocking=False):
                try:
                    acquired.set()
                finally:
                    BRIDGE.MT5_CONNECTION_LOCK.release()

        def serialize_without_the_lock(deals, from_utc, to_utc):
            thread = threading.Thread(target=competitor, daemon=True)
            thread.start()
            try:
                return original(deals, from_utc, to_utc)
            finally:
                thread.join(5)

        BRIDGE.collect_history_page = serialize_without_the_lock
        self.addCleanup(setattr, BRIDGE, "collect_history_page", original)

        status, body = self.request()
        self.assertEqual(status, 200)
        self.assertTrue(
            acquired.is_set(),
            "the connection lock was still held while the page was serialized",
        )
        self.assertEqual(STUB.mutations, [])

    def test_continuation_requires_matching_boot_and_generation(self):
        status, initial = self.request()
        self.assertEqual(status, 200)
        valid = {"bridge_boot_id": initial["bridge_boot_id"],
                 "connection_generation": str(initial["connection_generation"])}
        self.assertEqual(self.request(valid)[0], 200)
        for overrides in (
            {"bridge_boot_id": "other"}, {"connection_generation": str(initial["connection_generation"] + 1)},
        ):
            status, body = self.request({**valid, **overrides})
            self.assert_failure(status, body, 409, "MT5_CONNECTION_CHANGED")
        status, body = self.request({"bridge_boot_id": initial["bridge_boot_id"]})
        self.assert_failure(status, body, 400, "INVALID_HISTORY_QUERY")

    def test_history_exception_returns_no_partial_data(self):
        def fail():
            raise RuntimeError("read failed")
        STUB.history_hook = fail
        status, body = self.request()
        self.assert_failure(status, body, 503, "MT5_HISTORY_READ_FAILED")


class ConnectionSerializationTests(HistoryContractTests):
    def test_connection_mutations_invalidate_prior_pages_even_on_failure(self):
        for mutation in (
            BRIDGE.initialize_mt5,
            lambda: BRIDGE.switch_mt5_account(654321, server="Other-Demo"),
            BRIDGE.ensure_mt5_connection,
            BRIDGE.mt5_disconnect,
        ):
            for fails in (False, True):
                with self.subTest(mutation=mutation, fails=fails):
                    STUB.reset()
                    _, first = self.request()
                    if mutation is BRIDGE.ensure_mt5_connection:
                        STUB.account = None
                        STUB.terminal = None
                    STUB.initialize_success = not fails
                    BRIDGE.MT5_CONNECTED = True
                    with BRIDGE.app.test_request_context():
                        mutation()
                    STUB.account = {"login": 123456, "server": "Broker-Demo", "currency": "USD"}
                    STUB.terminal = {"name": "isolated fixture"}
                    status, body = self.request({
                        "bridge_boot_id": first["bridge_boot_id"],
                        "connection_generation": str(first["connection_generation"]),
                    })
                    self.assert_failure(status, body, 409, "MT5_CONNECTION_CHANGED")

    def test_noop_switch_and_healthy_check_do_not_invalidate(self):
        _, first = self.request()
        self.assertTrue(BRIDGE.ensure_mt5_connection())
        self.assertTrue(BRIDGE.switch_mt5_account(123456, server="Broker-Demo"))
        status, body = self.request({
            "bridge_boot_id": first["bridge_boot_id"],
            "connection_generation": str(first["connection_generation"]),
        })
        self.assertEqual(status, 200)
        self.assertEqual(STUB.mutations, [])

    def test_connection_operations_never_overlap_a_native_history_read(self):
        lock = getattr(BRIDGE, "MT5_CONNECTION_LOCK", None)
        self.assertIsNotNone(lock, "History and connection mutations need one shared RLock")
        operations = (
            BRIDGE.initialize_mt5,
            lambda: BRIDGE.switch_mt5_account(654321, server="Other-Demo"),
            BRIDGE.ensure_mt5_connection,
            BRIDGE.mt5_disconnect,
        )
        for operation in operations:
            with self.subTest(operation=operation):
                STUB.reset()
                BRIDGE.MT5_CONNECTED = True
                started = threading.Event()
                finished = threading.Event()
                errors = []
                threads = []

                def worker():
                    try:
                        started.set()
                        with BRIDGE.app.test_request_context():
                            operation()
                    except Exception as error:
                        errors.append(error)
                    finally:
                        finished.set()

                def during_read():
                    if operation is BRIDGE.ensure_mt5_connection:
                        STUB.terminal = None
                    thread = threading.Thread(target=worker, daemon=True)
                    threads.append(thread)
                    thread.start()
                    self.assertTrue(started.wait(1))
                    self.assertFalse(finished.wait(0.03))
                    self.assertEqual(STUB.mutations, [])
                    STUB.terminal = {"name": "isolated fixture"}

                STUB.history_hook = during_read
                status, body = self.request()
                # The mutation is locked out of the native read, so it can only
                # land in the gap between two guarded reads: either the scan
                # answered first, or the mutation stranded the page.
                self.assertIn(status, (200, 409))
                if status == 409:
                    self.assertEqual(body["code"], "MT5_CONNECTION_CHANGED")
                self.assertTrue(finished.wait(1))
                for thread in threads:
                    thread.join(1)
                self.assertEqual(errors, [])

    def test_same_thread_connection_lock_is_reentrant(self):
        lock = getattr(BRIDGE, "MT5_CONNECTION_LOCK", None)
        self.assertIsNotNone(lock)
        with lock:
            self.assertTrue(BRIDGE.ensure_mt5_connection())
            self.assertEqual(self.request()[0], 200)


if __name__ == "__main__":
    unittest.main()
