"""
Unit tests for the MT5 bridge broker-clock helper and the clock fields carried
by the /mt5/positions response.

These tests never reach a terminal. MetaTrader5 is replaced by a stub before
app.py is loaded, the stub refuses every call this suite has not written down,
and socket.connect is patched so an accidental network call fails the test
instead of leaving the machine. The bridge is loaded from source under a
distinct module name so no running application is imported or affected.
"""

import collections
import contextlib
import importlib.util
import io
from pathlib import Path
import socket
import sys
import unittest
from unittest.mock import patch


LOCAL_NOW_SECONDS = 1500000000.0
LOCAL_NOW_MSC = 1500000000000

POSITION_TICK_MSC = 1767225600123
POSITION_TICK_SECONDS = 1767225600

COMMON_TICK_MSC = 1700000000456
COMMON_TICK_SECONDS = 1700000000


class ForbiddenNetworkCall(AssertionError):
    pass


class StubMT5:
    """
    Minimal MetaTrader5 stand-in for the clock paths.

    Ticks are served from `ticks`, so a symbol that is not in the table simply
    has no tick, which is how "no usable tick" is produced without any broker.
    Anything this suite has not declared a fixture for raises.
    """

    def __init__(self):
        self.reset()
        self.constants = {}

    def reset(self):
        self.account = {
            "login": 123456,
            "server": "Broker-Demo",
            "currency": "USD",
        }
        self.terminal = {"name": "isolated fixture"}
        self.positions = []
        self.ticks = {}
        self.calls = []
        self.mutations = []
        self.tick_hook = None
        self.initialize_success = True

    def terminal_info(self):
        return self.terminal

    def account_info(self):
        if self.account is None:
            return None

        return collections.namedtuple("Account", self.account)(**self.account)

    def positions_get(self):
        self.calls.append(("positions_get",))
        return self.positions

    def symbol_info(self, symbol):
        self.calls.append(("symbol_info", symbol))

        # No symbol record: the positions route then reports a zero margin
        # without reading a tick, so the tick calls below belong to the clock.
        return None

    def symbol_info_tick(self, symbol):
        self.calls.append(("symbol_info_tick", symbol))

        if self.tick_hook:
            self.tick_hook(symbol)

        return self.ticks.get(symbol)

    def initialize(self, **kwargs):
        # Recorded rather than forbidden: the connection check reaches it only
        # when the terminal is already gone, and a test that sees a mutation
        # here has changed the connection state it was supposed to leave alone.
        self.mutations.append(("initialize", kwargs))

        if not self.initialize_success:
            return False

        return True

    def shutdown(self):
        self.mutations.append(("shutdown", {}))
        return None

    def last_error(self):
        return (4002, "isolated fixture")

    def __getattr__(self, name):
        if name.startswith("__") and name.endswith("__"):
            raise AttributeError(name)

        if name.isupper():
            return self.constants.setdefault(name, len(self.constants) + 1000)

        raise AttributeError(
            f"The MetaTrader5 stub has no {name!r}. Add it deliberately if a "
            "tested path really needs it."
        )


STUB = StubMT5()

MODULE_SPEC = importlib.util.spec_from_file_location(
    "isolated_broker_clock_bridge",
    Path(__file__).with_name("app.py"),
)
BRIDGE = importlib.util.module_from_spec(MODULE_SPEC)

with patch.dict(sys.modules, {"MetaTrader5": STUB}):
    MODULE_SPEC.loader.exec_module(BRIDGE)

if BRIDGE.mt5 is not STUB:
    raise RuntimeError(
        "The isolated bridge must bind only the MT5 replacement"
    )


# ----------------------------------------------------------
# FIXTURES
# ----------------------------------------------------------

def tick(**overrides):
    fields = {
        "ask": 1.1,
        "bid": 1.0999,
        "last": 1.1,
        "volume": 10,
        "time": POSITION_TICK_SECONDS,
        "time_msc": POSITION_TICK_MSC,
    }

    fields.update(overrides)

    return collections.namedtuple("Tick", fields)(**fields)


def position(**overrides):
    fields = {
        "ticket": 7001,
        "identifier": 6001,
        "symbol": "EURUSD",
        "type": 0,
        "volume": 0.2,
        "price_open": 1.2,
        "price_current": 1.1,
        "sl": 1.0,
        "tp": 1.4,
        "profit": -2.0,
        "swap": 0.0,
        "commission": -0.1,
        "time": POSITION_TICK_SECONDS,
        "time_msc": POSITION_TICK_MSC,
    }

    fields.update(overrides)

    return collections.namedtuple("Position", fields)(**fields)


class ClockTestCase(unittest.TestCase):
    def setUp(self):
        STUB.reset()

        self.network_guard = patch.object(
            socket.socket,
            "connect",
            side_effect=ForbiddenNetworkCall("Network is forbidden"),
        )
        self.network_guard.start()
        self.addCleanup(self.network_guard.stop)

        self.stdout_guard = contextlib.redirect_stdout(io.StringIO())
        self.stdout_guard.__enter__()
        self.addCleanup(self.stdout_guard.__exit__, None, None, None)

        # A local clock that cannot be confused with any broker timestamp.
        self.time_guard = patch("time.time", return_value=LOCAL_NOW_SECONDS)
        self.time_guard.start()
        self.addCleanup(self.time_guard.stop)

    def broker_clock(self, positions=None):
        return BRIDGE.get_broker_clock(positions)

    def request_positions(self):
        with BRIDGE.app.test_request_context("/mt5/positions"):
            response = BRIDGE.app.make_response(BRIDGE.mt5_positions())

        return response.status_code, response.get_json()


class BrokerClockSourceTests(ClockTestCase):
    def test_position_symbol_tick_time_msc_wins_and_is_labelled(self):
        STUB.ticks = {
            "USDJPY": tick(time=1767225599, time_msc=1767225599500),
            "EURUSD": tick(time=COMMON_TICK_SECONDS, time_msc=COMMON_TICK_MSC),
        }

        result = self.broker_clock(
            [position(symbol="USDJPY")]
        )

        self.assertEqual(result["time_msc"], 1767225599500)
        self.assertEqual(result["source"], "tick.time_msc")
        self.assertEqual(
            STUB.calls,
            [("symbol_info_tick", "USDJPY")],
        )

    def test_seconds_only_tick_is_labelled_with_its_own_source(self):
        STUB.ticks = {
            "EURUSD": tick(time=POSITION_TICK_SECONDS, time_msc=0),
        }

        result = self.broker_clock([position()])

        self.assertEqual(
            result["time_msc"],
            POSITION_TICK_SECONDS * 1000,
        )
        self.assertEqual(result["source"], "tick.time")

    def test_common_symbol_tick_is_labelled_as_a_fallback_symbol(self):
        STUB.ticks = {
            "GBPUSD": tick(time=COMMON_TICK_SECONDS, time_msc=COMMON_TICK_MSC),
        }

        result = self.broker_clock(
            [position(symbol="NOSUCHSYMBOL")]
        )

        self.assertEqual(result["time_msc"], COMMON_TICK_MSC)
        self.assertEqual(
            result["source"],
            "fallback_symbol_tick.time_msc",
        )

    def test_no_usable_tick_falls_back_to_local_wall_clock_and_says_so(self):
        STUB.ticks = {
            "EURUSD": tick(time=0, time_msc=0),
        }

        result = self.broker_clock([position()])

        self.assertEqual(result["time_msc"], LOCAL_NOW_MSC)
        self.assertEqual(result["source"], "local_wall_clock")

    def test_empty_position_list_uses_the_common_symbol_fallback(self):
        STUB.ticks = {
            "XAUUSD": tick(
                time=COMMON_TICK_SECONDS,
                time_msc=COMMON_TICK_MSC,
            ),
        }

        result = self.broker_clock([])

        self.assertEqual(result["time_msc"], COMMON_TICK_MSC)
        self.assertEqual(
            result["source"],
            "fallback_symbol_tick.time_msc",
        )

    def test_tick_read_exception_falls_back_to_local_wall_clock(self):
        def explode(symbol):
            raise RuntimeError("isolated broker failure")

        STUB.tick_hook = explode
        STUB.ticks = {
            "EURUSD": tick(),
        }

        result = self.broker_clock([position()])

        self.assertEqual(result["time_msc"], LOCAL_NOW_MSC)
        self.assertEqual(result["source"], "local_wall_clock")

    def test_legacy_helper_still_returns_only_the_timestamp(self):
        STUB.ticks = {
            "EURUSD": tick(),
        }

        legacy = BRIDGE.get_broker_time_msc([position()])

        self.assertEqual(legacy, POSITION_TICK_MSC)
        self.assertIsInstance(legacy, int)

    def test_legacy_helper_returns_local_time_when_no_tick_exists(self):
        legacy = BRIDGE.get_broker_time_msc([])

        self.assertEqual(legacy, LOCAL_NOW_MSC)


class PositionsClockContractTests(ClockTestCase):
    def test_positions_response_includes_tick_sourced_marker(self):
        STUB.positions = [position()]
        STUB.ticks = {
            "EURUSD": tick(),
        }

        status, body = self.request_positions()

        self.assertEqual(status, 200)
        self.assertEqual(body["broker_time_msc"], POSITION_TICK_MSC)
        self.assertEqual(body["broker_time_source"], "tick.time_msc")

    def test_positions_response_marks_local_fallback_without_a_tick(self):
        STUB.positions = [position()]
        STUB.ticks = {}

        status, body = self.request_positions()

        self.assertEqual(status, 200)
        self.assertEqual(body["broker_time_msc"], LOCAL_NOW_MSC)
        self.assertEqual(body["broker_time_source"], "local_wall_clock")

    def test_existing_positions_response_fields_are_unchanged(self):
        STUB.positions = [position()]
        STUB.ticks = {
            "EURUSD": tick(),
        }

        status, body = self.request_positions()

        self.assertEqual(status, 200)
        self.assertEqual(
            set(body),
            {
                "success",
                "connected",
                "login",
                "mt5Login",
                "server",
                "mt5Server",
                "count",
                "positions",
                "broker_time_msc",
                "broker_time_source",
            },
        )

        self.assertTrue(body["success"])
        self.assertTrue(body["connected"])
        self.assertEqual(body["login"], 123456)
        self.assertEqual(body["mt5Login"], 123456)
        self.assertEqual(body["server"], "Broker-Demo")
        self.assertEqual(body["mt5Server"], "Broker-Demo")
        self.assertEqual(body["count"], 1)

        [only] = body["positions"]

        self.assertEqual(only["ticket"], 7001)
        self.assertEqual(only["symbol"], "EURUSD")
        self.assertEqual(only["time_msc"], POSITION_TICK_MSC)
        self.assertEqual(
            only["broker_time_msc"],
            POSITION_TICK_MSC,
        )
        self.assertEqual(only["margin"], 0.0)
        self.assertIn("raw", only)

    def test_unreachable_broker_response_keeps_omitting_clock_fields(self):
        original = BRIDGE.ensure_mt5_connection

        BRIDGE.ensure_mt5_connection = lambda: False

        self.addCleanup(
            setattr,
            BRIDGE,
            "ensure_mt5_connection",
            original,
        )

        status, body = self.request_positions()

        self.assertEqual(status, 503)
        self.assertFalse(body["success"])
        self.assertEqual(body["positions"], [])
        self.assertNotIn("broker_time_msc", body)
        self.assertNotIn("broker_time_source", body)

    def test_clock_reads_never_initialize_or_shut_the_terminal_down(self):
        STUB.positions = [position()]
        STUB.ticks = {
            "EURUSD": tick(),
        }

        self.request_positions()

        self.broker_clock([position()])

        self.assertEqual(STUB.mutations, [])


if __name__ == "__main__":
    unittest.main()
