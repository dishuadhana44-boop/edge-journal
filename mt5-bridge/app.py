from flask import Flask, jsonify, request
from flask_cors import CORS

import MetaTrader5 as mt5

from datetime import datetime, timedelta, timezone
from decimal import (
    Decimal,
    InvalidOperation,
    ROUND_FLOOR,
    ROUND_HALF_UP,
)

import traceback
import json
import math
import threading
import time
import uuid


# ==========================================================
# APP
# ==========================================================

app = Flask(__name__)

CORS(
    app,
    resources={
        r"/*": {
            "origins": "*"
        }
    }
)


# ==========================================================
# CONFIG
# ==========================================================

MT5_CONNECTED = False

EDGEFLO_MAGIC = 2026001

BRIDGE_HOST = "127.0.0.1"
BRIDGE_PORT = 5001


# ==========================================================
# CONNECTION SERIALIZATION
# ==========================================================
#
# Every MT5 connection mutation and every reconciliation read takes this one
# reentrant lock, so a scan can never observe an account switch in flight.
# Each attempted mutation bumps CONNECTION_GENERATION first: a page taken
# before any mutation, successful or not, belongs to a dead generation.

MT5_CONNECTION_LOCK = threading.RLock()

BRIDGE_BOOT_ID = uuid.uuid4().hex

CONNECTION_GENERATION = 0


def current_connection_generation():
    return CONNECTION_GENERATION


def _mt5_connection_mutation(func, *args, **kwargs):
    """
    Run an MT5 call that changes the bridge connection.

    The generation is invalidated before the call, so even a failing
    initialize/shutdown strands earlier scan pages.
    """

    global CONNECTION_GENERATION

    with MT5_CONNECTION_LOCK:
        CONNECTION_GENERATION += 1

        return func(
            *args,
            **kwargs
        )


# ==========================================================
# SERIALIZATION HELPERS
# ==========================================================

def serialize_value(value):
    """
    Convert MT5 namedtuples, datetimes, lists and dictionaries
    into JSON-safe Python values.
    """

    try:
        if isinstance(value, datetime):
            return value.isoformat()

        if hasattr(value, "_asdict"):
            return {
                key: serialize_value(val)
                for key, val in value._asdict().items()
            }

        if isinstance(value, dict):
            return {
                key: serialize_value(val)
                for key, val in value.items()
            }

        if isinstance(value, (list, tuple)):
            return [
                serialize_value(item)
                for item in value
            ]

        return value

    except Exception:
        return str(value)


def serialize_mt5_data(data):
    return serialize_value(data)


def mt5_error():
    """
    Return the current MT5 last error.
    """

    try:
        error = mt5.last_error()

        return {
            "code": int(error[0]),
            "message": str(error[1])
        }

    except Exception as error:
        return {
            "code": -1,
            "message": str(error)
        }


# ==========================================================
# MT5 INITIALIZATION
# ==========================================================

def initialize_mt5():
    with MT5_CONNECTION_LOCK:
        return _initialize_mt5_locked()


def _initialize_mt5_locked():
    global MT5_CONNECTED

    try:
        print("")
        print("====================================")
        print("🚀 EDGEFLO MT5 BRIDGE")
        print("====================================")
        print(
            f"Bridge URL: http://{BRIDGE_HOST}:{BRIDGE_PORT}"
        )
        print(
            f"Magic: {EDGEFLO_MAGIC}"
        )
        print("====================================")

        initialized = _mt5_connection_mutation(
            mt5.initialize
        )

        if not initialized:
            MT5_CONNECTED = False

            print("")
            print(
                "❌ MT5 INITIALIZATION FAILED"
            )
            print(
                "MT5 ERROR:",
                mt5_error()
            )

            return False

        account = mt5.account_info()

        if account is None:
            MT5_CONNECTED = False

            print("")
            print(
                "❌ MT5 ACCOUNT INFORMATION UNAVAILABLE"
            )
            print(
                "MT5 ERROR:",
                mt5_error()
            )

            return False

        MT5_CONNECTED = True

        terminal = mt5.terminal_info()

        print("")
        print("====================================")
        print("✅ MT5 INITIALIZED")
        print("====================================")

        if terminal:
            print(
                "Terminal:",
                getattr(
                    terminal,
                    "name",
                    "MetaTrader 5"
                )
            )
        else:
            print(
                "Terminal: MetaTrader 5"
            )

        print(
            "Account:",
            getattr(
                account,
                "login",
                "Unknown"
            )
        )

        print("====================================")

        return True

    except Exception as error:
        MT5_CONNECTED = False

        print("")
        print(
            "❌ MT5 INITIALIZATION EXCEPTION:",
            error
        )

        traceback.print_exc()

        return False

# ==========================================================
# MT5 ACCOUNT SWITCH
# ==========================================================

def switch_mt5_account(
    login,
    password=None,
    server=None,
):
    with MT5_CONNECTION_LOCK:
        return _switch_mt5_account_locked(
            login,
            password=password,
            server=server
        )


def _switch_mt5_account_locked(
    login,
    password=None,
    server=None,
):
    """
    Switch the MT5 bridge to a specific trading account.

    login:
        MT5 account/login number

    password:
        MT5 account password

    server:
        MT5 broker server name
    """

    global MT5_CONNECTED

    try:
        login = int(login)

        if login <= 0:
            print(
                "❌ INVALID MT5 LOGIN:",
                login
            )
            return False

        server = (
            str(server).strip()
            if server
            else None
        )

        password = (
            str(password)
            if password is not None
            else None
        )

        print("")
        print(
            "===================================="
        )
        print(
            "🔄 MT5 ACCOUNT SWITCH REQUEST"
        )
        print(
            "===================================="
        )
        print(
            "Login:",
            login
        )
        print(
            "Server:",
            server
        )

        # --------------------------------------------------
        # CURRENT ACCOUNT
        # --------------------------------------------------

        current_account = (
            mt5.account_info()
        )

        current_login = None

        if current_account is not None:
            current_login = getattr(
                current_account,
                "login",
                None
            )

        # Already connected to requested account.
        if (
            current_login is not None
            and int(current_login) == login
        ):
            print(
                "✅ MT5 ALREADY CONNECTED TO ACCOUNT:",
                login
            )

            MT5_CONNECTED = True

            return True

        # --------------------------------------------------
        # INITIALIZE / REINITIALIZE
        # --------------------------------------------------

        try:
            _mt5_connection_mutation(
                mt5.shutdown
            )
        except Exception:
            pass

        initialized = False

        # --------------------------------------------------
        # LOGIN + SERVER + PASSWORD
        # --------------------------------------------------

        if (
            password is not None
            and server
        ):
            initialized = _mt5_connection_mutation(
                mt5.initialize,
                login=login,
                password=password,
                server=server
            )

        elif server:
            initialized = _mt5_connection_mutation(
                mt5.initialize,
                login=login,
                server=server
            )

        else:
            initialized = _mt5_connection_mutation(
                mt5.initialize,
                login=login
            )

        if not initialized:
            MT5_CONNECTED = False

            print(
                "❌ MT5 ACCOUNT SWITCH FAILED"
            )

            print(
                "MT5 ERROR:",
                mt5_error()
            )

            return False

        # --------------------------------------------------
        # VERIFY ACCOUNT
        # --------------------------------------------------

        connected_account = (
            mt5.account_info()
        )

        if connected_account is None:
            MT5_CONNECTED = False

            print(
                "❌ MT5 ACCOUNT INFO UNAVAILABLE AFTER SWITCH"
            )

            print(
                "MT5 ERROR:",
                mt5_error()
            )

            return False

        connected_login = getattr(
            connected_account,
            "login",
            None
        )

        if (
            connected_login is None
            or int(connected_login) != login
        ):
            MT5_CONNECTED = False

            print(
                "❌ MT5 ACCOUNT VERIFICATION FAILED"
            )

            print(
                "Requested:",
                login
            )

            print(
                "Connected:",
                connected_login
            )

            return False

        MT5_CONNECTED = True

        print(
            "✅ MT5 ACCOUNT SWITCHED SUCCESSFULLY"
        )

        print(
            "Connected Login:",
            connected_login
        )

        print(
            "Connected Server:",
            getattr(
                connected_account,
                "server",
                None
            )
        )

        return True

    except Exception as error:

        print(
            "❌ MT5 ACCOUNT SWITCH ERROR:",
            error
        )

        traceback.print_exc()

        MT5_CONNECTED = False

        return False

# ==========================================================
# CONNECTION CHECK
# ==========================================================

def ensure_mt5_connection():
    with MT5_CONNECTION_LOCK:
        return _ensure_mt5_connection_locked()


def _ensure_mt5_connection_locked():
    global MT5_CONNECTED

    try:
        terminal = mt5.terminal_info()
        account = mt5.account_info()

        if terminal is None or account is None:
            MT5_CONNECTED = False

            initialized = _mt5_connection_mutation(
                mt5.initialize
            )

            if not initialized:
                return False

            account = mt5.account_info()

            if account is None:
                MT5_CONNECTED = False
                return False

        MT5_CONNECTED = True

        return True

    except Exception as error:
        print(
            "❌ MT5 CONNECTION CHECK ERROR:",
            error
        )

        MT5_CONNECTED = False

        return False


# ==========================================================
# SYMBOL HELPERS
# ==========================================================

def ensure_symbol(symbol):
    """
    Make sure the requested symbol exists and is visible.
    """

    try:
        symbol = str(
            symbol or ""
        ).upper().strip()

        if not symbol:
            return None

        info = mt5.symbol_info(symbol)

        if info is None:
            return None

        if not info.visible:
            selected = mt5.symbol_select(
                symbol,
                True
            )

            if not selected:
                return None

        return mt5.symbol_info(symbol)

    except Exception as error:
        print(
            "❌ SYMBOL CHECK ERROR:",
            error
        )

        return None


def get_symbol_digits(symbol):
    try:
        info = ensure_symbol(symbol)

        if info is None:
            return 5

        return int(
            getattr(
                info,
                "digits",
                5
            ) or 5
        )

    except Exception:
        return 5


def normalize_price(symbol, price):
    """
    Normalize price according to MT5 symbol digits.
    """

    try:
        price = float(price)

        if not math.isfinite(price):
            return None

        if price <= 0:
            return None

        digits = get_symbol_digits(
            symbol
        )

        return round(
            price,
            digits
        )

    except Exception as error:
        print(
            "⚠️ PRICE NORMALIZATION ERROR:",
            error
        )

        return None


# ==========================================================
# DECIMAL VOLUME GRID
#
# Volume is a grid quantity, not a free float: the broker only accepts
# volume_min + k * volume_step. Floats cannot express that grid reliably
# (0.01 + 0.02 is not 0.03, and 0.1 * 3 is not 0.3), so every grid decision is
# taken in Decimal arithmetic built from the decimal *string* of the value, and
# equality is decided on Decimal values and integer grid indices rather than on
# float equality.
#
# Nothing here invents a grid: if the broker does not report a usable
# volume_min / volume_max / volume_step the symbol has no grid and every volume
# is refused. A requested volume is never raised to the minimum, because that
# raises the risk the trader sized the trade for.
# ==========================================================

VOLUME_DECIMAL_PLACES = 8


def decimal_or_none(value):
    """
    Strict Decimal conversion. Accepts only real, finite, non-boolean numbers.
    """

    try:
        if value is None:
            return None

        if isinstance(value, bool):
            return None

        if isinstance(value, Decimal):
            decimal_value = value

        elif isinstance(value, (int, float)):
            decimal_value = Decimal(
                repr(float(value))
            )

        elif isinstance(value, str):
            text = value.strip()

            if text == "":
                return None

            decimal_value = Decimal(
                text
            )

        else:
            return None

        if not decimal_value.is_finite():
            return None

        return decimal_value

    except (InvalidOperation, ValueError, TypeError):
        return None


def symbol_volume_grid(symbol):
    """
    Return the broker's own volume grid for a symbol, or a refusal with reason.
    """

    info = ensure_symbol(symbol)

    if info is None:
        return {
            "ok": False,
            "code": "SYMBOL_NOT_FOUND",
            "message":
                f"MT5 symbol not found: {symbol}",
        }

    volume_min = decimal_or_none(
        getattr(
            info,
            "volume_min",
            None,
        )
    )

    volume_max = decimal_or_none(
        getattr(
            info,
            "volume_max",
            None,
        )
    )

    volume_step = decimal_or_none(
        getattr(
            info,
            "volume_step",
            None,
        )
    )

    missing = [
        name
        for name, value in (
            ("volume_min", volume_min),
            ("volume_max", volume_max),
            ("volume_step", volume_step),
        )
        if value is None
    ]

    if missing:
        return {
            "ok": False,
            "code": "INVALID_VOLUME_SPEC",
            "message":
                "The broker did not report a usable volume grid for "
                f"{symbol} (missing {', '.join(missing)}), so no volume "
                "can be validated for it.",
        }

    if volume_min <= 0 or volume_step <= 0 or volume_max <= 0:
        return {
            "ok": False,
            "code": "INVALID_VOLUME_SPEC",
            "message":
                f"The broker reported a non-positive volume grid for {symbol} "
                f"(volume_min {volume_min}, volume_max {volume_max}, "
                f"volume_step {volume_step}), so no volume can be validated "
                "for it.",
        }

    if volume_max < volume_min:
        return {
            "ok": False,
            "code": "INVALID_VOLUME_SPEC",
            "message":
                f"The broker reported volume_max below volume_min for {symbol}, "
                "so no volume can be validated for it.",
        }

    return {
        "ok": True,
        "symbol": symbol,
        "volume_min": volume_min,
        "volume_max": volume_max,
        "volume_step": volume_step,
    }


# A volume counts as sitting on the grid when it is within this fraction of one
# step of a grid value. Binary floats cannot hold 0.03 or 0.3 exactly, and a
# trader's own 0.01 * 3 arrives as 0.030000000000000002; refusing that would be
# refusing a valid broker volume over representation noise. The tolerance is far
# too small to ever accept a genuinely wrong volume: half a step is 500000x it.
GRID_SNAP_STEPS = Decimal("0.000001")


def volume_grid_index(volume, volume_min, volume_step):
    """
    Integer grid index k with volume == volume_min + k * volume_step, or None.

    Decided on the step index rather than on raw decimals so float noise snaps,
    while a real off-grid request (0.015 on a 0.01 step) stays rejected.
    """

    if volume < volume_min:
        return None

    steps = (
        volume - volume_min
    ) / volume_step

    nearest = steps.to_integral_value(
        rounding=ROUND_HALF_UP
    )

    if abs(steps - nearest) <= GRID_SNAP_STEPS:
        return int(nearest)

    return None


def floor_volume_to_grid(volume, volume_min, volume_step):
    """
    Largest permitted grid volume that is <= the requested volume.

    Returns None when the requested volume is below the broker minimum: the
    caller refuses, it does not raise. Raising a sub-minimum volume to the
    minimum silently increases the risk of the trade.
    """

    steps = (
        volume - volume_min
    ) / volume_step

    if steps < 0:
        return None

    index = volume_grid_index(
        volume,
        volume_min,
        volume_step,
    )

    if index is None:
        index = int(
            steps.to_integral_value(
                rounding=ROUND_FLOOR
            )
        )

    if index < 0:
        return None

    floored = (
        volume_min
        + index * volume_step
    )

    if floored < volume_min:
        return None

    return floored


def is_volume_on_grid(volume, volume_min, volume_step):
    """
    Exact grid membership, decided on integer step counts in Decimal space.
    """

    return (
        volume_grid_index(
            volume,
            volume_min,
            volume_step,
        )
        is not None
    )


def normalize_open_volume(symbol, volume):
    """
    Normalize volume for new market/pending orders.

    The grid is aligned from the broker's volume_min and floored, never rounded:
    rounding up through the grid spends more of the risk budget than the trader
    asked for. A volume below volume_min returns None instead of being raised to
    it.
    """

    try:
        requested = decimal_or_none(volume)

        if requested is None or requested <= 0:
            return None

        grid = symbol_volume_grid(symbol)

        if not grid.get("ok"):
            return None

        volume_min = grid["volume_min"]
        volume_max = grid["volume_max"]
        volume_step = grid["volume_step"]

        if requested > volume_max:
            return None

        floored = floor_volume_to_grid(
            requested,
            volume_min,
            volume_step,
        )

        if floored is None:
            return None

        if floored > volume_max:
            return None

        return float(
            round(
                floored,
                VOLUME_DECIMAL_PLACES,
            )
        )

    except Exception as error:
        print(
            "⚠️ OPEN VOLUME NORMALIZATION ERROR:",
            error
        )

        return None


def reconcile_requested_volume(
    requested,
    normalized,
    volume_min=None,
    volume_step=None,
):
    """
    Confirm that normalizing did not move the order to a different grid volume.

    Both sides are Decimal, and the comparison is on integer grid indices rather
    than on raw decimals, so float representation noise (0.01 * 3 arriving as
    0.030000000000000002) is not reported as a changed volume while a real
    change (0.03 against 0.04) still is. No float equality is involved.
    """

    requested_d = decimal_or_none(requested)
    normalized_d = decimal_or_none(normalized)

    if requested_d is None or normalized_d is None:
        return False

    if requested_d == normalized_d:
        return True

    if volume_min is None or volume_step is None:
        return False

    if volume_min <= 0 or volume_step <= 0:
        return False

    requested_index = volume_grid_index(
        requested_d,
        volume_min,
        volume_step,
    )

    normalized_index = volume_grid_index(
        normalized_d,
        volume_min,
        volume_step,
    )

    if requested_index is None or normalized_index is None:
        return False

    return requested_index == normalized_index


def validate_requested_open_volume(symbol, requested_volume):
    """
    Single gate used by every order path: the requested volume must already be a
    valid broker volume. Nothing is adjusted, so the volume that reaches MT5 is
    exactly the volume the trader sized the trade with.
    """

    requested = decimal_or_none(requested_volume)

    if requested is None or requested <= 0:
        return {
            "ok": False,
            "code": "INVALID_VOLUME",
            "message":
                "The requested volume is missing, not a number, or not greater "
                "than zero.",
        }

    grid = symbol_volume_grid(symbol)

    if not grid.get("ok"):
        return {
            "ok": False,
            "code": grid["code"],
            "message": grid["message"],
            "requested_volume": float(requested),
        }

    volume_min = grid["volume_min"]
    volume_max = grid["volume_max"]
    volume_step = grid["volume_step"]

    result = {
        "requested_volume": float(requested),
        "volume_min": float(volume_min),
        "volume_max": float(volume_max),
        "volume_step": float(volume_step),
    }

    if requested < volume_min:
        return {
            **result,
            "ok": False,
            "code": "BELOW_BROKER_MINIMUM",
            "message":
                f"The requested volume {requested} is below the broker minimum "
                f"{volume_min} for {symbol}. It was not raised to the minimum, "
                "because that would increase the risk of the order.",
        }

    if requested > volume_max:
        return {
            **result,
            "ok": False,
            "code": "ABOVE_BROKER_MAXIMUM",
            "message":
                f"The requested volume {requested} is above the broker maximum "
                f"{volume_max} for {symbol}.",
        }

    if not is_volume_on_grid(
        requested,
        volume_min,
        volume_step,
    ):
        floored = floor_volume_to_grid(
            requested,
            volume_min,
            volume_step,
        )

        return {
            **result,
            "ok": False,
            "code": "OFF_GRID_VOLUME",
            "message":
                f"The requested volume {requested} is not on the broker volume "
                f"grid for {symbol} (volume_min {volume_min}, volume_step "
                f"{volume_step}).",
            "nearest_valid_volume": (
                float(floored)
                if floored is not None
                else None
            ),
        }

    normalized = normalize_open_volume(
        symbol,
        requested,
    )

    if normalized is None:
        return {
            **result,
            "ok": False,
            "code": "VOLUME_NORMALIZATION_FAILED",
            "message":
                f"The broker volume grid for {symbol} rejected the requested "
                f"volume {requested}.",
        }

    if not reconcile_requested_volume(
        requested,
        normalized,
        volume_min,
        volume_step,
    ):
        return {
            **result,
            "ok": False,
            "code": "VOLUME_MISMATCH",
            "message":
                f"Normalizing the requested volume {requested} for {symbol} "
                f"would change it to {normalized}, so the order was rejected "
                "instead of silently adjusting the volume.",
            "normalized_volume": normalized,
        }

    return {
        **result,
        "ok": True,
        "code": "OK",
        "message": "",
        "volume": normalized,
    }


def volume_error_payload(symbol, validation):
    """
    JSON body for a refused volume.
    """

    return {
        "success": False,
        "symbol": symbol,
        "error": validation.get("code"),
        "message": validation.get("message"),
        "requested_volume": validation.get("requested_volume"),
        "volume_min": validation.get("volume_min"),
        "volume_max": validation.get("volume_max"),
        "volume_step": validation.get("volume_step"),
    }


# ==========================================================
# VOLUME NORMALIZATION
# ==========================================================

def normalize_volume(symbol, volume):
    """
    Normalize closing volume.
    """

    try:
        volume = float(volume)

        if volume <= 0:
            return None

        info = ensure_symbol(symbol)

        if info is None:
            return None

        volume_min = float(
            getattr(
                info,
                "volume_min",
                0.01
            ) or 0.01
        )

        volume_max = float(
            getattr(
                info,
                "volume_max",
                volume
            ) or volume
        )

        volume_step = float(
            getattr(
                info,
                "volume_step",
                0.01
            ) or 0.01
        )

        volume = max(
            volume_min,
            min(
                volume,
                volume_max
            )
        )

        if volume_step > 0:
            steps = math.floor(
                (
                    volume -
                    volume_min
                ) / volume_step + 1e-9
            )

            volume = (
                volume_min +
                steps * volume_step
            )

        return round(
            volume,
            8
        )

    except Exception as error:
        print(
            "⚠️ CLOSE VOLUME NORMALIZATION ERROR:",
            error
        )

        return None


# ==========================================================
# FILLING MODES
# ==========================================================

def get_filling_modes(symbol):
    """
    Return safe filling modes for market orders.
    """

    modes = []

    try:
        info = ensure_symbol(symbol)

        if info is not None:
            filling_mode = int(
                getattr(
                    info,
                    "filling_mode",
                    0
                ) or 0
            )

            # FOK
            if filling_mode & 1:
                modes.append(
                    mt5.ORDER_FILLING_FOK
                )

            # IOC
            if filling_mode & 2:
                modes.append(
                    mt5.ORDER_FILLING_IOC
                )

    except Exception as error:
        print(
            "⚠️ FILLING MODE DETECTION ERROR:",
            error
        )

    # Safe fallback order.
    fallback = [
        mt5.ORDER_FILLING_FOK,
        mt5.ORDER_FILLING_IOC,
        mt5.ORDER_FILLING_RETURN
    ]

    for mode in fallback:
        if mode not in modes:
            modes.append(mode)

    return modes


def is_success_retcode(retcode):
    return int(retcode) in (
        mt5.TRADE_RETCODE_DONE,
        mt5.TRADE_RETCODE_PLACED,
        mt5.TRADE_RETCODE_DONE_PARTIAL
    )


# ==========================================================
# POSITION HELPERS
# ==========================================================

def position_still_exists(ticket):
    try:
        ticket = int(ticket)

        positions = mt5.positions_get(
            ticket=ticket
        )

        return bool(
            positions and
            len(positions) > 0
        )

    except Exception:
        return False


def calculate_position_margin(position):
    """
    Calculate margin for an open position
    using broker-side MT5 calculation.
    """

    try:
        symbol = str(
            getattr(
                position,
                "symbol",
                ""
            ) or ""
        ).upper().strip()

        volume = float(
            getattr(
                position,
                "volume",
                0.0
            ) or 0.0
        )

        if not symbol or volume <= 0:
            return 0.0

        symbol_info = mt5.symbol_info(
            symbol
        )

        if symbol_info is None:
            return 0.0

        if not symbol_info.visible:
            if not mt5.symbol_select(
                symbol,
                True
            ):
                return 0.0

        tick = mt5.symbol_info_tick(
            symbol
        )

        if tick is None:
            return 0.0

        position_type = getattr(
            position,
            "type",
            None
        )

        if position_type == mt5.POSITION_TYPE_BUY:
            order_type = mt5.ORDER_TYPE_BUY
            price = float(
                tick.ask or 0.0
            )

        elif position_type == mt5.POSITION_TYPE_SELL:
            order_type = mt5.ORDER_TYPE_SELL
            price = float(
                tick.bid or 0.0
            )

        else:
            return 0.0

        if price <= 0:
            return 0.0

        margin = mt5.order_calc_margin(
            order_type,
            symbol,
            volume,
            price
        )

        if margin is None:
            return 0.0

        margin = float(margin)

        if not math.isfinite(margin):
            return 0.0

        return margin

    except Exception as error:
        print(
            "⚠️ POSITION MARGIN CALCULATION ERROR:",
            error
        )

        return 0.0


def get_position_time_msc(
    position,
    position_dict=None
):
    try:
        position_dict = (
            position_dict
            if isinstance(
                position_dict,
                dict
            )
            else {}
        )

        value = position_dict.get(
            "time_msc"
        )

        if value:
            return int(value)

        value = getattr(
            position,
            "time_msc",
            None
        )

        if value:
            return int(value)

        value = getattr(
            position,
            "time",
            None
        )

        if value:
            return int(value) * 1000

    except Exception:
        pass

    return None


# ==========================================================
# BROKER CLOCK
# ==========================================================

def broker_clock_from_tick(symbol, fallback_symbol=False):
    """
    Read one symbol's tick time, or None when the tick carries no time at all.

    `fallback_symbol` only chooses the label. Both readings are broker time, but
    a symbol taken from a fixed list is not a symbol the trader holds, and the
    timestamp alone cannot show that difference.
    """

    tick = mt5.symbol_info_tick(
        symbol
    )

    if tick is None:
        return None

    prefix = (
        "fallback_symbol_tick."
        if fallback_symbol
        else "tick."
    )

    tick_time_msc = getattr(
        tick,
        "time_msc",
        None
    )

    if tick_time_msc:
        return {
            "time_msc": int(tick_time_msc),
            "source": f"{prefix}time_msc"
        }

    tick_time = getattr(
        tick,
        "time",
        None
    )

    if tick_time:
        return {
            "time_msc": int(tick_time) * 1000,
            "source": f"{prefix}time"
        }

    return None


def get_broker_clock(positions=None):
    """
    Get MT5 broker/server time and say where the number came from.

    `time_msc` on its own cannot tell the broker's clock from this machine's, so
    every path labels itself: a tick from a held symbol, a tick from a common
    symbol, or the local wall clock when no tick was usable or reading one
    raised. A caller that needs broker time must check the label.
    """

    try:
        positions = (
            positions
            if positions is not None
            else []
        )

        # First try open position symbols.
        for position in positions:

            symbol = str(
                getattr(
                    position,
                    "symbol",
                    ""
                ) or ""
            ).upper().strip()

            if not symbol:
                continue

            clock = broker_clock_from_tick(symbol)

            if clock:
                print(
                    "🕒 MT5 BROKER CLOCK:",
                    {
                        "symbol": symbol,
                        "source": clock["source"],
                        "broker_time_msc": clock["time_msc"]
                    }
                )

                return clock

        # Fallback: use a known common symbol.
        common_symbols = [
            "EURUSD",
            "GBPUSD",
            "USDJPY",
            "XAUUSD",
            "US30",
            "NAS100"
        ]

        for symbol in common_symbols:

            clock = broker_clock_from_tick(
                symbol,
                fallback_symbol=True
            )

            if clock:
                return clock

    except Exception as error:
        print(
            "⚠️ BROKER CLOCK ERROR:",
            error
        )

    return {
        "time_msc": int(
            time.time() * 1000
        ),
        "source": "local_wall_clock"
    }


def get_broker_time_msc(positions=None):
    """
    Get MT5 broker/server time in milliseconds.
    """

    return get_broker_clock(
        positions
    )["time_msc"]


# ==========================================================
# PENDING ORDER HELPERS
# ==========================================================

PENDING_ORDER_TYPES = {
    "BUY_LIMIT": mt5.ORDER_TYPE_BUY_LIMIT,
    "SELL_LIMIT": mt5.ORDER_TYPE_SELL_LIMIT,
    "BUY_STOP": mt5.ORDER_TYPE_BUY_STOP,
    "SELL_STOP": mt5.ORDER_TYPE_SELL_STOP
}


def get_pending_order_by_ticket(ticket):
    try:
        ticket = int(ticket)

        if ticket <= 0:
            return None

        orders = mt5.orders_get(
            ticket=ticket
        )

        if orders is None:
            return None

        if len(orders) == 0:
            return None

        return orders[0]

    except Exception as error:
        print(
            "❌ GET PENDING ORDER ERROR:",
            error
        )

        return None


def serialize_pending_order(order):
    """
    Convert an MT5 pending order into
    EdgeFlo-friendly JSON.
    """

    try:
        if order is None:
            return None

        data = serialize_value(
            order
        )

        if not isinstance(
            data,
            dict
        ):
            return data

        order_type = getattr(
            order,
            "type",
            None
        )

        type_names = {
            mt5.ORDER_TYPE_BUY_LIMIT:
                "BUY_LIMIT",

            mt5.ORDER_TYPE_SELL_LIMIT:
                "SELL_LIMIT",

            mt5.ORDER_TYPE_BUY_STOP:
                "BUY_STOP",

            mt5.ORDER_TYPE_SELL_STOP:
                "SELL_STOP",

            mt5.ORDER_TYPE_BUY_STOP_LIMIT:
                "BUY_STOP_LIMIT",

            mt5.ORDER_TYPE_SELL_STOP_LIMIT:
                "SELL_STOP_LIMIT"
        }

        order_type_name = type_names.get(
            order_type,
            str(order_type)
        )

        symbol = str(
            getattr(
                order,
                "symbol",
                ""
            ) or ""
        ).upper()

        ticket = int(
            getattr(
                order,
                "ticket",
                0
            ) or 0
        )

        volume = float(
            getattr(
                order,
                "volume_current",
                getattr(
                    order,
                    "volume_initial",
                    0
                )
            ) or 0
        )

        price_open = float(
            getattr(
                order,
                "price_open",
                0
            ) or 0
        )

        sl = float(
            getattr(
                order,
                "sl",
                0
            ) or 0
        )

        tp = float(
            getattr(
                order,
                "tp",
                0
            ) or 0
        )

        time_value = getattr(
            order,
            "time_setup",
            getattr(
                order,
                "time",
                None
            )
        )

        time_setup_msc = getattr(
            order,
            "time_setup_msc",
            None
        )

        if (
            time_setup_msc is None
            and time_value is not None
        ):
            try:
                time_setup_msc = (
                    int(time_value) *
                    1000
                )
            except Exception:
                time_setup_msc = None

        if order_type in (
            mt5.ORDER_TYPE_BUY_LIMIT,
            mt5.ORDER_TYPE_BUY_STOP,
            mt5.ORDER_TYPE_BUY_STOP_LIMIT
        ):
            side = "BUY"
        else:
            side = "SELL"

        data.update({

            "ticket":
                ticket,

            "orderId":
                ticket,

            "id":
                ticket,

            "symbol":
                symbol,

            "type":
                order_type_name,

            "orderType":
                order_type_name,

            "side":
                side,

            "volume":
                volume,

            "lots":
                volume,

            "price":
                price_open,

            "entry":
                price_open,

            "priceOpen":
                price_open,

            "sl":
                sl,

            "stopLoss":
                sl,

            "tp":
                tp,

            "takeProfit":
                tp,

            "comment":
                str(
                    getattr(
                        order,
                        "comment",
                        ""
                    ) or ""
                ),

            "magic":
                int(
                    getattr(
                        order,
                        "magic",
                        0
                    ) or 0
                ),

            "time":
                time_value,

            "time_setup_msc":
                time_setup_msc,

            "state":
                str(
                    getattr(
                        order,
                        "state",
                        ""
                    )
                ),

            "type_time":
                int(
                    getattr(
                        order,
                        "type_time",
                        0
                    ) or 0
                ),

            "type_filling":
                int(
                    getattr(
                        order,
                        "type_filling",
                        0
                    ) or 0
                )
        })

        return data

    except Exception as error:
        print(
            "❌ SERIALIZE PENDING ORDER ERROR:",
            error
        )

        return None


# ==========================================================
# HEALTH
# ==========================================================

@app.route(
    "/health",
    methods=["GET"]
)
def health():
    connected = ensure_mt5_connection()

    return jsonify({
        "success": True,
        "bridge": "EdgeFlo MT5 Bridge",
        "connected": connected,
        "timestamp":
            datetime.now().isoformat()
    })

# ==========================================================
# CONNECT / SWITCH MT5 ACCOUNT
# POST /mt5/connect
# ==========================================================

@app.route(
    "/mt5/connect",
    methods=["POST"]
)
def mt5_connect():
    try:
        data = request.get_json(
            silent=True
        ) or {}

        account_id = data.get(
            "accountId"
        )

        login = data.get(
            "login"
        )

        password = data.get(
            "password"
        )

        server = data.get(
            "server"
        )

        print("")
        print("====================================")
        print("🔵 EDGEFLO MT5 ACCOUNT CONNECT")
        print("====================================")
        print("EdgeFlo Account ID:", account_id)
        print("MT5 Login:", login)
        print("MT5 Server:", server)
        print(
            "Password Provided:",
            bool(password)
        )

        # --------------------------------------------------
        # VALIDATION
        # --------------------------------------------------

        if (
            account_id is None
            or str(account_id).strip() == ""
        ):
            return jsonify({
                "success": False,
                "connected": False,
                "message":
                    "EdgeFlo account ID is required."
            }), 400

        try:
            login = int(login)
        except (
            TypeError,
            ValueError
        ):
            return jsonify({
                "success": False,
                "connected": False,
                "message":
                    "Valid MT5 login is required."
            }), 400

        if login <= 0:
            return jsonify({
                "success": False,
                "connected": False,
                "message":
                    "Valid MT5 login is required."
            }), 400

        if (
            server is None
            or str(server).strip() == ""
        ):
            return jsonify({
                "success": False,
                "connected": False,
                "message":
                    "MT5 server is required."
            }), 400

        server = str(server).strip()

        # --------------------------------------------------
        # SWITCH MT5 ACCOUNT
        # --------------------------------------------------

        connected = switch_mt5_account(
            login=login,
            password=password,
            server=server,
        )

        if not connected:
            print("")
            print(
                "❌ EDGEFLO MT5 ACCOUNT CONNECTION FAILED"
            )
            print(
                "MT5 ERROR:",
                mt5_error()
            )

            return jsonify({
                "success": False,
                "connected": False,
                "message":
                    "Unable to connect to the requested MT5 account.",
                "error":
                    mt5_error(),
                "account": {
                    "login": login,
                    "server": server,
                }
            }), 503

        # --------------------------------------------------
        # VERIFY CONNECTED ACCOUNT
        # --------------------------------------------------

        account = mt5.account_info()

        if account is None:
            print(
                "❌ MT5 ACCOUNT INFO UNAVAILABLE"
            )

            return jsonify({
                "success": False,
                "connected": False,
                "message":
                    "MT5 connected but account information is unavailable.",
                "error":
                    mt5_error()
            }), 503

        connected_login = getattr(
            account,
            "login",
            None
        )

        connected_server = getattr(
            account,
            "server",
            None
        )

        print("")
        print("====================================")
        print("✅ EDGEFLO MT5 ACCOUNT CONNECTED")
        print("====================================")
        print(
            "EdgeFlo Account ID:",
            account_id
        )
        print(
            "MT5 Login:",
            connected_login
        )
        print(
            "MT5 Server:",
            connected_server
        )

        return jsonify({            
            "success": True,
            "connected": True,
            "accountId": str(account_id),
            "account": {
                "login": connected_login,
                "server": connected_server,
                "balance": float(getattr(account, "balance", 0) or 0),
                "equity": float(getattr(account, "equity", 0) or 0),
                "margin": float(getattr(account, "margin", 0) or 0),
                "margin_free": float(
                    getattr(account, "margin_free", 0) or 0
                ),
                "freeMargin": float(
                    getattr(account, "margin_free", 0) or 0
                ),
                "currency": getattr(
                    account, "currency", "USD"
                ),
                "leverage": int(
                    getattr(account, "leverage", 0) or 0
                ),
                "profit": float(
                    getattr(account, "profit", 0) or 0
                ),
                "margin_level": float(
                    getattr(account, "margin_level", 0) or 0
                ),
                "name": getattr(
                    account, "name", None
                ),
                "company": getattr(
                    account, "company", None
                ),
            },
            "message":
                "MetaTrader 5 connected successfully."
        }), 200

    except Exception as error:
        print(
            "❌ MT5 CONNECT ERROR:",
            error
        )

        traceback.print_exc()

        return jsonify({
            "success": False,
            "connected": False,
            "message":
                "MT5 connection failed.",
            "error":
                str(error)
        }), 500

# ==========================================================
# STATUS
# ==========================================================

@app.route(
    "/mt5/status",
    methods=["GET"]
)
def mt5_status():
    try:
        connected = ensure_mt5_connection()

        account = (
            mt5.account_info()
            if connected
            else None
        )

        return jsonify({
            "success": True,
            "connected": connected,

            "account": (
                serialize_value(account)
                if account
                else None
            ),

            "magic":
                EDGEFLO_MAGIC,

            "timestamp":
                datetime.now().isoformat()
        })

    except Exception as error:
        return jsonify({
            "success": False,
            "connected": False,
            "message":
                "MT5 status failed.",
            "error":
                str(error)
        }), 500


# ==========================================================
# ACCOUNT
# ==========================================================

@app.route(
    "/mt5/account",
    methods=["GET"]
)
def mt5_account():
    try:
        if not ensure_mt5_connection():
            return jsonify({
                "success": False,
                "connected": False,
                "message":
                    "MT5 is not connected.",
                "error":
                    mt5_error()
            }), 503

        account = mt5.account_info()

        if account is None:
            return jsonify({
                "success": False,
                "message":
                    "Unable to fetch MT5 account.",
                "error":
                    mt5_error()
            }), 500

        return jsonify({
            "success": True,
            "connected": True,
            "account":
                serialize_value(account)
        })

    except Exception as error:
        return jsonify({
            "success": False,
            "message":
                "MT5 account error.",
            "error":
                str(error)
        }), 500


# ==========================================================
# PRICE
# GET /mt5/price?symbol=EURUSD
# ==========================================================

@app.route(
    "/mt5/price",
    methods=["GET"]
)
def mt5_price():
    try:
        if not ensure_mt5_connection():
            return jsonify({
                "success": False,
                "connected": False,
                "message":
                    "MT5 is not connected."
            }), 503

        symbol = str(
            request.args.get(
                "symbol",
                "EURUSD"
            )
        ).upper().strip()

        info = ensure_symbol(
            symbol
        )

        if info is None:
            return jsonify({
                "success": False,
                "symbol": symbol,
                "message":
                    f"MT5 symbol not found: {symbol}"
            }), 404

        tick = mt5.symbol_info_tick(
            symbol
        )

        if tick is None:
            return jsonify({
                "success": False,
                "symbol": symbol,
                "message":
                    "Unable to fetch MT5 tick.",
                "error":
                    mt5_error()
            }), 500

        bid = float(
            getattr(
                tick,
                "bid",
                0
            ) or 0
        )

        ask = float(
            getattr(
                tick,
                "ask",
                0
            ) or 0
        )

        spread = (
            ask - bid
            if bid > 0 and ask > 0
            else 0
        )

        return jsonify({
            "success": True,
            "connected": True,
            "symbol": symbol,

            "bid": bid,
            "ask": ask,
            "spread": spread,

            "digits":
                int(
                    getattr(
                        info,
                        "digits",
                        5
                    ) or 5
                ),

            "time":
                getattr(
                    tick,
                    "time",
                    None
                ),

            "time_msc":
                getattr(
                    tick,
                    "time_msc",
                    None
                )
        })

    except Exception as error:
        print(
            "❌ MT5 PRICE ERROR:",
            error
        )

        return jsonify({
            "success": False,
            "message":
                "MT5 price error.",
            "error":
                str(error)
        }), 500

# ==========================================================
# SYMBOL SPECIFICATION
# GET /mt5/symbol-info?symbol=EURUSD
#
# Automatic sizing needs the broker's own contract metadata. Every field is
# reported exactly as the broker gave it, or marked unusable: this route never
# substitutes a default, because an invented volume_step, contract size or tick
# value would silently change a position size.
#
# `fields_present` is the list of keys this MT5 build actually exposes on the
# symbol record, so a caller can prove a field is absent instead of mistaking a
# placeholder 0.0 for a real value.
# ==========================================================

SYMBOL_INFO_NUMBER_FIELDS = [
    "volume_min",
    "volume_max",
    "volume_step",
    "trade_contract_size",
    "trade_tick_size",
    "trade_tick_value",
    "trade_tick_value_profit",
    "trade_tick_value_loss",
]

SYMBOL_INFO_TEXT_FIELDS = [
    "currency_profit",
    "currency_margin",
    "currency_base",
]


def spec_field_status(value):
    """
    Classify one broker specification value without repairing it.
    """

    if value is None:
        return "missing"

    if isinstance(value, bool):
        return "not_a_number"

    if isinstance(value, (int, float)):
        if not math.isfinite(float(value)):
            return "non_finite"

        if float(value) <= 0:
            return "non_positive"

        return "ok"

    if isinstance(value, str):
        text = value.strip()

        if text == "":
            return "missing"

        return "not_a_number"

    return "not_a_number"


@app.route(
    "/mt5/symbol-info",
    methods=["GET"]
)
def mt5_symbol_info():
    try:
        if not ensure_mt5_connection():
            return jsonify({
                "success": False,
                "connected": False,
                "message":
                    "MT5 is not connected."
            }), 503

        symbol = str(
            request.args.get(
                "symbol",
                ""
            )
        ).upper().strip()

        if symbol == "":
            return jsonify({
                "success": False,
                "message":
                    "A symbol is required."
            }), 400

        info = ensure_symbol(
            symbol
        )

        if info is None:
            return jsonify({
                "success": False,
                "connected": True,
                "symbol": symbol,
                "message":
                    f"MT5 symbol not found: {symbol}"
            }), 404

        try:
            record = (
                info._asdict()
                if hasattr(info, "_asdict")
                else {
                    key: getattr(info, key, None)
                    for key in dir(info)
                    if not key.startswith("_")
                }
            )

        except Exception:
            record = {}

        fields_present = sorted(
            str(key)
            for key in record.keys()
        )

        specification = {}
        status = {}

        for field in SYMBOL_INFO_NUMBER_FIELDS:
            value = record.get(
                field,
                None
            )

            field_status = spec_field_status(value)

            status[field] = field_status
            specification[field] = (
                float(value)
                if field_status == "ok"
                else None
            )

        for field in SYMBOL_INFO_TEXT_FIELDS:
            value = record.get(
                field,
                None
            )

            text = (
                str(value).strip().upper()
                if value is not None
                else ""
            )

            if text == "":
                status[field] = "missing"
                specification[field] = None

            else:
                status[field] = "ok"
                specification[field] = text

        digits_raw = record.get(
            "digits",
            None
        )

        digits = (
            int(digits_raw)
            if isinstance(digits_raw, int)
            and not isinstance(digits_raw, bool)
            else None
        )

        status["digits"] = (
            "ok"
            if digits is not None and digits >= 0
            else "missing"
        )

        calc_mode_raw = record.get(
            "trade_calc_mode",
            None
        )

        calc_mode = (
            int(calc_mode_raw)
            if isinstance(calc_mode_raw, int)
            and not isinstance(calc_mode_raw, bool)
            else None
        )

        status["trade_calc_mode"] = (
            "ok"
            if calc_mode is not None
            else "missing"
        )

        required_ok = all(
            status[field] == "ok"
            for field in (
                "volume_min",
                "volume_max",
                "volume_step",
            )
        )

        return jsonify({
            "success": True,
            "connected": True,
            "symbol": symbol,

            "digits": digits,
            "spec": specification,
            "spec_status": status,
            "fields_present": fields_present,

            "volume_grid_usable": required_ok,
            "recorded_at": int(
                time.time() * 1000
            ),
        })

    except Exception as error:
        print(
            "❌ MT5 SYMBOL INFO ERROR:",
            error
        )

        return jsonify({
            "success": False,
            "message":
                "MT5 symbol info error.",
            "error":
                str(error)
        }), 500


# ==========================================================
# ESTIMATED PROFIT / LOSS (READ ONLY)
# GET /mt5/calc-profit?symbol&action&volume&price_open&price_close
#
# MetaTrader documents this calculation as returning "profit in the account
# currency" for the current account, which makes it the only broker figure whose
# monetary unit is stated rather than inferred. The tick-value fields carry no
# documented currency or volume basis, so risk is measured here instead of being
# derived from them.
#
# This handler performs a calculation only.
# ==========================================================

@app.route(
    "/mt5/calc-profit",
    methods=["GET"]
)
def mt5_calc_profit():
    try:
        if not ensure_mt5_connection():
            return jsonify({
                "success": False,
                "connected": False,
                "message":
                    "MT5 is not connected."
            }), 503

        symbol = str(
            request.args.get(
                "symbol",
                ""
            )
        ).upper().strip()

        if symbol == "":
            return jsonify({
                "success": False,
                "error": "MISSING_SYMBOL",
                "message":
                    "A symbol is required."
            }), 400

        raw_action = str(
            request.args.get(
                "action",
                ""
            )
        ).upper().strip()

        if raw_action in ("BUY", "0"):
            action = mt5.ORDER_TYPE_BUY
            action_name = "BUY"

        elif raw_action in ("SELL", "1"):
            action = mt5.ORDER_TYPE_SELL
            action_name = "SELL"

        else:
            return jsonify({
                "success": False,
                "error": "INVALID_ACTION",
                "message":
                    "action must be BUY or SELL.",
                "symbol": symbol,
            }), 400

        volume = decimal_or_none(
            request.args.get(
                "volume"
            )
        )

        if volume is None or volume <= 0:
            return jsonify({
                "success": False,
                "error": "INVALID_VOLUME",
                "message":
                    "volume must be a finite number greater than zero.",
                "symbol": symbol,
            }), 400

        price_open = normalize_price(
            symbol,
            request.args.get(
                "price_open"
            )
        )

        price_close = normalize_price(
            symbol,
            request.args.get(
                "price_close"
            )
        )

        if price_open is None or price_close is None:
            return jsonify({
                "success": False,
                "error": "INVALID_PRICE",
                "message":
                    "price_open and price_close must be finite positive "
                    "prices for this symbol.",
                "symbol": symbol,
            }), 400

        if price_open == price_close:
            return jsonify({
                "success": False,
                "error": "INVALID_PRICE",
                "message":
                    "price_open and price_close must differ.",
                "symbol": symbol,
            }), 400

        # The same gate the order paths use. A volume the broker would refuse for
        # an order is refused here too, so a risk measurement can never be taken
        # at a volume that cannot actually be traded, and the volume measured is
        # the exact volume that would be submitted.
        volume_gate = validate_requested_open_volume(
            symbol,
            volume,
        )

        if not volume_gate.get("ok"):
            return jsonify({
                "success": False,
                "error": volume_gate["code"],
                "message": volume_gate["message"],
                "symbol": symbol,
                "volume": float(volume),
                "volume_min": volume_gate.get("volume_min"),
                "volume_max": volume_gate.get("volume_max"),
                "volume_step": volume_gate.get("volume_step"),
            }), 400

        trade_volume = volume_gate["volume"]

        profit = mt5.order_calc_profit(
            action,
            symbol,
            float(trade_volume),
            float(price_open),
            float(price_close),
        )

        if profit is None:
            return jsonify({
                "success": False,
                "error": "BROKER_RISK_UNAVAILABLE",
                "message":
                    "The broker could not calculate this position's profit, "
                    "so no monetary risk can be established for it.",
                "symbol": symbol,
                "volume": trade_volume,
                "price_open": price_open,
                "price_close": price_close,
                "error_detail": mt5_error(),
            }), 502

        profit_value = float(profit)

        if not math.isfinite(profit_value):
            return jsonify({
                "success": False,
                "error": "BROKER_RISK_INVALID",
                "message":
                    "The broker returned a profit figure that is not a finite "
                    "number, so it cannot be used for risk sizing.",
                "symbol": symbol,
                "volume": trade_volume,
            }), 502

        account = mt5.account_info()

        account_currency = (
            str(
                getattr(
                    account,
                    "currency",
                    ""
                ) or ""
            ).strip().upper()
            if account is not None
            else ""
        )

        if account_currency == "":
            return jsonify({
                "success": False,
                "error": "ACCOUNT_CURRENCY_UNAVAILABLE",
                "message":
                    "The account currency could not be read, so the broker's "
                    "profit figure cannot be attributed to a currency.",
                "symbol": symbol,
                "volume": trade_volume,
                "profit": profit_value,
            }), 502

        if profit_value == 0.0:
            return jsonify({
                "success": False,
                "error": "ZERO_RISK_RESPONSE",
                "message":
                    "The broker reports no monetary result for a non-zero "
                    "price difference on this symbol, so its risk cannot be "
                    "measured.",
                "symbol": symbol,
                "volume": trade_volume,
                "price_open": price_open,
                "price_close": price_close,
                "profit": profit_value,
                "account_currency": account_currency,
            }), 422

        return jsonify({
            "success": True,
            "connected": True,

            "symbol": symbol,
            "action": int(action),
            "action_name": action_name,
            "volume": trade_volume,
            "price_open": price_open,
            "price_close": price_close,

            "profit": profit_value,
            "loss_abs": abs(
                profit_value
            ),

            "account_currency": account_currency,
            "currency_source": "account_info().currency",
            "calculation": "mt5.order_calc_profit",

            "volume_min": volume_gate["volume_min"],
            "volume_max": volume_gate["volume_max"],
            "volume_step": volume_gate["volume_step"],

            "recorded_at": int(
                time.time() * 1000
            ),
        })

    except Exception as error:
        print(
            "❌ MT5 CALC PROFIT ERROR:",
            error
        )

        return jsonify({
            "success": False,
            "error": "CALC_PROFIT_ERROR",
            "message":
                "MT5 profit calculation error.",
            "error_detail":
                str(error),
        }), 500


# ==========================================================
# CANDLES
# GET /mt5/candles?symbol=EURUSD&timeframe=H1&count=100
# ==========================================================

@app.route(
    "/mt5/candles",
    methods=["GET"]
)
def mt5_candles():

    try:

        if not ensure_mt5_connection():
            return jsonify({
                "success": False,
                "message": "MT5 is not connected."
            }), 503

        symbol = str(
            request.args.get(
                "symbol",
                "EURUSD"
            )
        ).upper().strip()

        timeframe_name = str(
            request.args.get(
                "timeframe",
                "H1"
            )
        ).upper()

        count = int(
            request.args.get(
                "count",
                100
            )
        )

        timeframe_map = {
            "M1": mt5.TIMEFRAME_M1,
            "M5": mt5.TIMEFRAME_M5,
            "M15": mt5.TIMEFRAME_M15,
            "M30": mt5.TIMEFRAME_M30,
            "H1": mt5.TIMEFRAME_H1,
            "H4": mt5.TIMEFRAME_H4,
            "D1": mt5.TIMEFRAME_D1,
        }

        timeframe = timeframe_map.get(
            timeframe_name,
            mt5.TIMEFRAME_H1
        )

        ensure_symbol(symbol)

        rates = mt5.copy_rates_from_pos(
            symbol,
            timeframe,
            0,
            count
        )

        if rates is None:
            return jsonify({
                "success": False,
                "message": "Unable to fetch candles.",
                "error": mt5_error()
            }), 500

        candles = []

        for row in rates:

            candles.append({
                "time": int(row["time"]),
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "volume": int(row["tick_volume"])
            })

        return jsonify({
            "success": True,
            "symbol": symbol,
            "timeframe": timeframe_name,
            "count": len(candles),
            "candles": candles
        })

    except Exception as error:

        return jsonify({
            "success": False,
            "message": str(error)
        }), 500

# ==========================================================
# OPEN POSITIONS
# ==========================================================

@app.route(
    "/mt5/positions",
    methods=["GET"]
)
def mt5_positions():
    try:
        if not ensure_mt5_connection():
            return jsonify({
                "success": False,
                "connected": False,
                "positions": [],
                "message":
                    "MT5 is not connected."
            }), 503

        positions = mt5.positions_get()

        if positions is None:
            positions = []

        account_info = mt5.account_info()

        if account_info is None:
            return jsonify({
                "success": False,
                "connected": False,
                "positions": [],
                "message":
                    "Unable to read the connected MT5 account."
            }), 503

        connected_mt5_login = int(
            getattr(
                account_info,
                "login",
                0
            ) or 0
        )

        connected_mt5_server = str(
            getattr(
                account_info,
                "server",
                ""
            ) or ""
        )

        broker_clock = (
            get_broker_clock(
                positions
            )
        )

        broker_time_msc = (
            broker_clock["time_msc"]
        )

        broker_time_source = (
            broker_clock["source"]
        )

        print(
            "🕒 MT5 POSITIONS BROKER CLOCK"
        )

        print(
            "broker_time_msc:",
            broker_time_msc
        )

        print(
            "broker_time_source:",
            broker_time_source
        )

        print(
            "👤 MT5 CONNECTED ACCOUNT:",
            {
                "login":
                    connected_mt5_login,
                "server":
                    connected_mt5_server
            }
        )

        result = []

        for position in positions:
            try:
                raw = serialize_value(
                    position
                )

                margin = (
                    calculate_position_margin(
                        position
                    )
                )

                time_msc = (
                    get_position_time_msc(
                        position,
                        raw
                    )
                )

                position_data = {
                    "login":
                        connected_mt5_login,

                    "mt5Login":
                        connected_mt5_login,

                    "server":
                        connected_mt5_server,

                    "mt5Server":
                        connected_mt5_server,

                    "ticket":
                        int(
                            getattr(
                                position,
                                "ticket",
                                0
                            ) or 0
                        ),

                    "positionId":
                        int(
                            getattr(
                                position,
                                "ticket",
                                0
                            ) or 0
                        ),

                    "brokerPositionId":
                        int(
                            getattr(
                                position,
                                "ticket",
                                0
                            ) or 0
                        ),

                    "symbol":
                        str(
                            getattr(
                                position,
                                "symbol",
                                ""
                            ) or ""
                        ).upper(),

                    "type":
                        int(
                            getattr(
                                position,
                                "type",
                                0
                            ) or 0
                        ),

                    "volume":
                        float(
                            getattr(
                                position,
                                "volume",
                                0
                            ) or 0
                        ),

                    "price_open":
                        float(
                            getattr(
                                position,
                                "price_open",
                                0
                            ) or 0
                        ),

                    "price_current":
                        float(
                            getattr(
                                position,
                                "price_current",
                                0
                            ) or 0
                        ),

                    "sl":
                        float(
                            getattr(
                                position,
                                "sl",
                                0
                            ) or 0
                        ),

                    "tp":
                        float(
                            getattr(
                                position,
                                "tp",
                                0
                            ) or 0
                        ),

                    "profit":
                        float(
                            getattr(
                                position,
                                "profit",
                                0
                            ) or 0
                        ),

                    "swap":
                        float(
                            getattr(
                                position,
                                "swap",
                                0
                            ) or 0
                        ),

                    "commission":
                        float(
                            getattr(
                                position,
                                "commission",
                                0
                            ) or 0
                        ),

                    "time":
                        getattr(
                            position,
                            "time",
                            None
                        ),

                    "time_msc":
                        time_msc,

                    "margin":
                        margin,

                    "usedMargin":
                        margin,

                    "broker_time_msc":
                        broker_time_msc,

                    "raw":
                        raw
                }

                result.append(
                    position_data
                )

                print(
                    "🕒 MT5 POSITION:",
                    {
                        "ticket":
                            position_data[
                                "ticket"
                            ],

                        "symbol":
                            position_data[
                                "symbol"
                            ],

                        "time":
                            position_data[
                                "time"
                            ],

                        "time_msc":
                            position_data[
                                "time_msc"
                            ],

                        "broker_time_msc":
                            broker_time_msc
                    }
                )

            except Exception as error:
                print(
                    "⚠️ POSITION SERIALIZATION ERROR:",
                    error
                )

        print(
            f"📊 MT5 OPEN POSITIONS: {len(result)}"
        )

        return jsonify({
            "success": True,

            "connected": True,

            "login":
                connected_mt5_login,

            "mt5Login":
                connected_mt5_login,

            "server":
                connected_mt5_server,

            "mt5Server":
                connected_mt5_server,

            "count":
                len(result),

            "positions":
                result,

            "broker_time_msc":
                broker_time_msc,

            "broker_time_source":
                broker_time_source
        })

    except Exception as error:
        print(
            "❌ MT5 POSITIONS ERROR:",
            error
        )

        traceback.print_exc()

        return jsonify({
            "success": False,
            "connected": False,
            "positions": [],
            "message":
                "Failed to fetch MT5 positions.",
            "error":
                str(error)
        }), 500


# ==========================================================
# MARKET ORDER
# POST /mt5/order
# ==========================================================

@app.route(
    "/mt5/order",
    methods=["POST"]
)
def mt5_order():
    try:
        data = request.get_json(
            silent=True
        ) or {}

        print("")
        print("====================================")
        print("🚀 EDGEFLO MT5 MARKET ORDER")
        print("====================================")

        symbol = str(
            data.get(
                "symbol",
                ""
            )
        ).upper().strip()

        side = str(
            data.get(
                "side",
                ""
            )
        ).upper().strip()

        lots = data.get(
            "lots"
        )

        stop_loss = data.get(
            "stopLoss"
        )

        take_profit = data.get(
            "takeProfit"
        )

        comment = str(
            data.get(
                "comment",
                "EdgeFlo MT5"
            )
            or "EdgeFlo MT5"
        )

        magic = int(
            data.get(
                "magic",
                EDGEFLO_MAGIC
            )
            or EDGEFLO_MAGIC
        )

        deviation = int(
            data.get(
                "deviation",
                50
            )
            or 50
        )

        # --------------------------------------------------
        # VALIDATION
        # --------------------------------------------------

        if not symbol:
            return jsonify({
                "success": False,
                "message":
                    "Symbol is required."
            }), 400

        if side not in (
            "BUY",
            "SELL"
        ):
            return jsonify({
                "success": False,
                "message":
                    "Side must be BUY or SELL."
            }), 400

        try:
            lots = float(lots)
        except Exception:
            return jsonify({
                "success": False,
                "message":
                    "Invalid lot size."
            }), 400

        if lots <= 0:
            return jsonify({
                "success": False,
                "message":
                    "Lot size must be greater than zero."
            }), 400

        if not ensure_mt5_connection():
            return jsonify({
                "success": False,
                "message":
                    "MT5 is not connected.",
                "error":
                    mt5_error()
            }), 503

        info = ensure_symbol(
            symbol
        )

        if info is None:
            return jsonify({
                "success": False,
                "message":
                    f"MT5 symbol not found: {symbol}"
            }), 404

        # --------------------------------------------------
        # NORMALIZE VOLUME
        #
        # The requested volume is validated against the broker grid, never
        # adjusted: an order whose volume the broker would move is refused
        # instead of being sent with more risk than the trader sized.
        # --------------------------------------------------

        volume_validation = (
            validate_requested_open_volume(
                symbol,
                lots
            )
        )

        if not volume_validation.get("ok"):
            return jsonify(
                volume_error_payload(
                    symbol,
                    volume_validation
                )
            ), 400

        normalized_volume = volume_validation["volume"]

        # --------------------------------------------------
        # PRICE
        # --------------------------------------------------

        tick = mt5.symbol_info_tick(
            symbol
        )

        if tick is None:
            return jsonify({
                "success": False,
                "message":
                    "Unable to get market price.",
                "error":
                    mt5_error()
            }), 500

        if side == "BUY":
            order_type = mt5.ORDER_TYPE_BUY
            execution_price = float(
                tick.ask or 0
            )
        else:
            order_type = mt5.ORDER_TYPE_SELL
            execution_price = float(
                tick.bid or 0
            )

        if execution_price <= 0:
            return jsonify({
                "success": False,
                "message":
                    "Invalid market execution price."
            }), 400

        execution_price = normalize_price(
            symbol,
            execution_price
        )

        # --------------------------------------------------
        # SL
        # --------------------------------------------------

        if stop_loss in (
            None,
            "",
            0,
            "0"
        ):
            normalized_sl = 0.0

        else:
            normalized_sl = normalize_price(
                symbol,
                stop_loss
            )

            if normalized_sl is None:
                return jsonify({
                    "success": False,
                    "message":
                        "Invalid Stop Loss."
                }), 400

        # --------------------------------------------------
        # TP
        # --------------------------------------------------

        if take_profit in (
            None,
            "",
            0,
            "0"
        ):
            normalized_tp = 0.0

        else:
            normalized_tp = normalize_price(
                symbol,
                take_profit
            )

            if normalized_tp is None:
                return jsonify({
                    "success": False,
                    "message":
                        "Invalid Take Profit."
                }), 400

        print(
            "Symbol:",
            symbol
        )

        print(
            "Side:",
            side
        )

        print(
            "Requested Lots:",
            lots
        )

        print(
            "Normalized Lots:",
            normalized_volume
        )

        print(
            "Bid:",
            getattr(
                tick,
                "bid",
                None
            )
        )

        print(
            "Ask:",
            getattr(
                tick,
                "ask",
                None
            )
        )

        print(
            "Execution Price:",
            execution_price
        )

        print(
            "Stop Loss:",
            normalized_sl
        )

        print(
            "Take Profit:",
            normalized_tp
        )

        print(
            "Magic:",
            magic
        )

        # --------------------------------------------------
        # TRY FILLING MODES
        # --------------------------------------------------

        filling_modes = get_filling_modes(
            symbol
        )

        print(
            "Filling Modes To Try:",
            filling_modes
        )

        last_check = None
        last_result = None

        for filling_mode in filling_modes:

            request_data = {
                "action":
                    mt5.TRADE_ACTION_DEAL,

                "symbol":
                    symbol,

                "volume":
                    normalized_volume,

                "type":
                    order_type,

                "price":
                    execution_price,

                "sl":
                    normalized_sl,

                "tp":
                    normalized_tp,

                "deviation":
                    deviation,

                "magic":
                    magic,

                "comment":
                    comment,

                "type_time":
                    mt5.ORDER_TIME_GTC,

                "type_filling":
                    filling_mode
            }

            print("")
            print(
                "ORDER CHECK:",
                serialize_value(
                    request_data
                )
            )

            check = mt5.order_check(
                request_data
            )

            last_check = check

            print(
                "ORDER CHECK RESULT:",
                serialize_value(check)
            )

            if check is not None:

                check_retcode = getattr(
                    check,
                    "retcode",
                    None
                )

                # 10030 = unsupported filling mode.
                if (
                    check_retcode is not None
                    and int(check_retcode)
                    == mt5.TRADE_RETCODE_INVALID_FILL
                ):
                    print(
                        "⚠️ Unsupported filling mode:",
                        filling_mode
                    )

                    continue

            result = mt5.order_send(
                request_data
            )

            last_result = result

            print(
                "MT5 ORDER RESULT:",
                serialize_value(result)
            )

            if result is None:
                continue

            retcode = getattr(
                result,
                "retcode",
                None
            )

            if retcode is None:
                continue

            retcode = int(
                retcode
            )

            if is_success_retcode(
                retcode
            ):

                deal = int(
                    getattr(
                        result,
                        "deal",
                        0
                    ) or 0
                )

                order = int(
                    getattr(
                        result,
                        "order",
                        0
                    ) or 0
                )

                print("")
                print(
                    "✅ MT5 MARKET ORDER SUCCESS"
                )

                print(
                    "Deal:",
                    deal
                )

                print(
                    "Order:",
                    order
                )

                print(
                    "Volume:",
                    getattr(
                        result,
                        "volume",
                        normalized_volume
                    )
                )

                print("")

                return jsonify({
                    "success": True,

                    "message":
                        "MT5 market order placed successfully.",

                    "retcode":
                        retcode,

                    "deal":
                        deal,

                    "order":
                        order,

                    "ticket":
                        order or deal,

                    "symbol":
                        symbol,

                    "side":
                        side,

                    "lots":
                        normalized_volume,

                    "volume":
                        normalized_volume,

                    "price":
                        float(
                            getattr(
                                result,
                                "price",
                                execution_price
                            )
                            or execution_price
                        ),

                    "stopLoss":
                        normalized_sl,

                    "takeProfit":
                        normalized_tp,

                    "result":
                        serialize_value(
                            result
                        ),

                    "check":
                        serialize_value(
                            check
                        )
                }), 200

        # --------------------------------------------------
        # FAILURE
        # --------------------------------------------------

        return jsonify({
            "success": False,

            "message":
                "MT5 rejected the market order.",

            "retcode":
                getattr(
                    last_result,
                    "retcode",
                    None
                )
                if last_result
                else None,

            "result":
                serialize_value(
                    last_result
                ),

            "check":
                serialize_value(
                    last_check
                ),

            "error":
                mt5_error()
        }), 400

    except Exception as error:

        print("")
        print(
            "❌ MT5 MARKET ORDER ERROR:",
            error
        )

        traceback.print_exc()

        return jsonify({
            "success": False,
            "message":
                "Failed to place MT5 market order.",
            "error":
                str(error)
        }), 500


# ==========================================================
# CREATE PENDING ORDER
# POST /mt5/pending-order
# ==========================================================

@app.route(
    "/mt5/pending-order",
    methods=["POST"]
)
def create_pending_order():
    try:

        data = request.get_json(
            silent=True
        ) or {}

        print("")
        print("====================================")
        print("📌 EDGEFLO MT5 PENDING ORDER")
        print("====================================")

        symbol = str(
            data.get(
                "symbol",
                ""
            )
        ).upper().strip()

        side = str(
            data.get(
                "side",
                ""
            )
        ).upper().strip()

        order_type_name = str(
            data.get(
                "orderType",
                ""
            )
        ).upper().strip()

        lots = data.get(
            "lots"
        )

        entry = data.get(
            "entry"
        )

        stop_loss = data.get(
            "stopLoss"
        )

        take_profit = data.get(
            "takeProfit"
        )

        comment = str(
            data.get(
                "comment",
                "EdgeFlo Pending"
            )
            or "EdgeFlo Pending"
        )

        magic = int(
            data.get(
                "magic",
                EDGEFLO_MAGIC
            )
            or EDGEFLO_MAGIC
        )

        # --------------------------------------------------
        # VALIDATION
        # --------------------------------------------------

        if not symbol:
            return jsonify({
                "success": False,
                "message":
                    "Symbol is required."
            }), 400

        if side not in (
            "BUY",
            "SELL"
        ):
            return jsonify({
                "success": False,
                "message":
                    "Side must be BUY or SELL."
            }), 400

        if order_type_name not in PENDING_ORDER_TYPES:
            return jsonify({
                "success": False,
                "message":
                    "Unsupported pending order type.",
                "supportedOrderTypes":
                    list(
                        PENDING_ORDER_TYPES.keys()
                    )
            }), 400

        # Side/type consistency.
        if (
            order_type_name.startswith("BUY")
            and side != "BUY"
        ):
            return jsonify({
                "success": False,
                "message":
                    "BUY pending order requires BUY side."
            }), 400

        if (
            order_type_name.startswith("SELL")
            and side != "SELL"
        ):
            return jsonify({
                "success": False,
                "message":
                    "SELL pending order requires SELL side."
            }), 400

        try:
            lots = float(lots)
        except Exception:
            return jsonify({
                "success": False,
                "message":
                    "Invalid lot size."
            }), 400

        if lots <= 0:
            return jsonify({
                "success": False,
                "message":
                    "Lot size must be greater than zero."
            }), 400

        try:
            entry = float(entry)
        except Exception:
            return jsonify({
                "success": False,
                "message":
                    "Invalid entry price."
            }), 400

        if entry <= 0:
            return jsonify({
                "success": False,
                "message":
                    "Entry price must be greater than zero."
            }), 400

        if not ensure_mt5_connection():
            return jsonify({
                "success": False,
                "message":
                    "MT5 is not connected.",
                "error":
                    mt5_error()
            }), 503

        # --------------------------------------------------
        # SYMBOL
        # --------------------------------------------------

        info = ensure_symbol(
            symbol
        )

        if info is None:
            return jsonify({
                "success": False,
                "message":
                    f"MT5 symbol not found: {symbol}"
            }), 404

        # --------------------------------------------------
        # VOLUME
        #
        # Validated against the broker grid and never adjusted, so a pending
        # order cannot be placed at a larger volume than was requested.
        # --------------------------------------------------

        volume_validation = (
            validate_requested_open_volume(
                symbol,
                lots
            )
        )

        if not volume_validation.get("ok"):
            return jsonify(
                volume_error_payload(
                    symbol,
                    volume_validation
                )
            ), 400

        volume = volume_validation["volume"]

        # --------------------------------------------------
        # PRICE
        # --------------------------------------------------

        entry = normalize_price(
            symbol,
            entry
        )

        if entry is None:
            return jsonify({
                "success": False,
                "message":
                    "Invalid entry price."
            }), 400

        # --------------------------------------------------
        # SL
        # --------------------------------------------------

        if stop_loss in (
            None,
            "",
            0,
            "0"
        ):
            normalized_sl = 0.0

        else:
            normalized_sl = normalize_price(
                symbol,
                stop_loss
            )

            if normalized_sl is None:
                return jsonify({
                    "success": False,
                    "message":
                        "Invalid Stop Loss."
                }), 400

        # --------------------------------------------------
        # TP
        # --------------------------------------------------

        if take_profit in (
            None,
            "",
            0,
            "0"
        ):
            normalized_tp = 0.0

        else:
            normalized_tp = normalize_price(
                symbol,
                take_profit
            )

            if normalized_tp is None:
                return jsonify({
                    "success": False,
                    "message":
                        "Invalid Take Profit."
                }), 400

        # --------------------------------------------------
        # CURRENT MARKET PRICE
        # --------------------------------------------------

        tick = mt5.symbol_info_tick(
            symbol
        )

        if tick is None:
            return jsonify({
                "success": False,
                "message":
                    "Unable to get current market price."
            }), 500

        bid = float(
            getattr(
                tick,
                "bid",
                0
            ) or 0
        )

        ask = float(
            getattr(
                tick,
                "ask",
                0
            ) or 0
        )

        # --------------------------------------------------
        # PENDING PRICE VALIDATION
        # --------------------------------------------------

        if (
            order_type_name == "BUY_LIMIT"
            and ask > 0
            and entry >= ask
        ):
            return jsonify({
                "success": False,
                "message":
                    "BUY LIMIT entry must be below current Ask.",
                "entry":
                    entry,
                "currentAsk":
                    ask
            }), 400

        if (
            order_type_name == "SELL_LIMIT"
            and bid > 0
            and entry <= bid
        ):
            return jsonify({
                "success": False,
                "message":
                    "SELL LIMIT entry must be above current Bid.",
                "entry":
                    entry,
                "currentBid":
                    bid
            }), 400

        if (
            order_type_name == "BUY_STOP"
            and ask > 0
            and entry <= ask
        ):
            return jsonify({
                "success": False,
                "message":
                    "BUY STOP entry must be above current Ask.",
                "entry":
                    entry,
                "currentAsk":
                    ask
            }), 400

        if (
            order_type_name == "SELL_STOP"
            and bid > 0
            and entry >= bid
        ):
            return jsonify({
                "success": False,
                "message":
                    "SELL STOP entry must be below current Bid.",
                "entry":
                    entry,
                "currentBid":
                    bid
            }), 400

        mt5_order_type = PENDING_ORDER_TYPES[
            order_type_name
        ]

        # --------------------------------------------------
        # IMPORTANT:
        # Pending orders use RETURN filling.
        #
        # This prevents the 10030
        # "Unsupported filling mode" problem
        # that happened when the pending request
        # was treated like a market order.
        # --------------------------------------------------

        filling_type = mt5.ORDER_FILLING_RETURN

        request_data = {
            "action":
                mt5.TRADE_ACTION_PENDING,

            "symbol":
                symbol,

            "volume":
                volume,

            "type":
                mt5_order_type,

            "price":
                entry,

            "sl":
                normalized_sl,

            "tp":
                normalized_tp,

            "deviation":
                50,

            "magic":
                magic,

            "comment":
                comment,

            "type_time":
                mt5.ORDER_TIME_GTC,

            "type_filling":
                filling_type
        }

        print(
            "Symbol:",
            symbol
        )

        print(
            "Side:",
            side
        )

        print(
            "Order Type:",
            order_type_name
        )

        print(
            "Lots:",
            volume
        )

        print(
            "Entry:",
            entry
        )

        print(
            "Stop Loss:",
            normalized_sl
        )

        print(
            "Take Profit:",
            normalized_tp
        )

        print(
            "Bid:",
            bid
        )

        print(
            "Ask:",
            ask
        )

        print(
            "Filling:",
            filling_type
        )

        # --------------------------------------------------
        # ORDER CHECK
        # --------------------------------------------------

        check = mt5.order_check(
            request_data
        )

        print("")
        print(
            "🔍 PENDING ORDER CHECK:"
        )

        print(
            serialize_value(check)
        )

        if check is None:
            return jsonify({
                "success": False,
                "message":
                    "MT5 order check returned no result.",
                "error":
                    mt5_error(),
                "request":
                    serialize_value(
                        request_data
                    )
            }), 400

        check_retcode = getattr(
            check,
            "retcode",
            None
        )

        if (
            check_retcode is not None
            and int(check_retcode) != 0
        ):

            return jsonify({
                "success": False,

                "message":
                    "MT5 rejected pending order during order check.",

                "retcode":
                    int(check_retcode),

                "check":
                    serialize_value(check),

                "request":
                    serialize_value(
                        request_data
                    )
            }), 400

        # --------------------------------------------------
        # SEND
        # --------------------------------------------------

        result = mt5.order_send(
            request_data
        )

        print("")
        print(
            "📩 MT5 PENDING ORDER RESULT:"
        )

        print(
            serialize_value(result)
        )

        if result is None:
            return jsonify({
                "success": False,
                "message":
                    "MT5 order_send returned no result.",
                "error":
                    mt5_error()
            }), 500

        retcode = getattr(
            result,
            "retcode",
            None
        )

        retcode_int = (
            int(retcode)
            if retcode is not None
            else None
        )

        # --------------------------------------------------
        # SUCCESS
        # --------------------------------------------------

        if retcode_int in (
            mt5.TRADE_RETCODE_DONE,
            mt5.TRADE_RETCODE_PLACED
        ):

            ticket = int(
                getattr(
                    result,
                    "order",
                    0
                ) or 0
            )

            pending_order = None

            if ticket > 0:
                pending_order = (
                    get_pending_order_by_ticket(
                        ticket
                    )
                )

            print("")
            print(
                "===================================="
            )

            print(
                "✅ MT5 PENDING ORDER SUCCESS"
            )

            print(
                "Ticket:",
                ticket
            )

            print(
                "Type:",
                order_type_name
            )

            print(
                "Entry:",
                entry
            )

            print(
                "Lots:",
                volume
            )

            print(
                "===================================="
            )

            return jsonify({

                "success":
                    True,

                "message":
                    "MT5 pending order placed successfully.",

                "retcode":
                    retcode_int,

                "ticket":
                    ticket,

                "order":
                    ticket,

                "orderId":
                    ticket,

                "symbol":
                    symbol,

                "side":
                    side,

                "orderType":
                    order_type_name,

                "type":
                    order_type_name,

                "lots":
                    volume,

                "volume":
                    volume,

                "entry":
                    entry,

                "price":
                    entry,

                "stopLoss":
                    normalized_sl,

                "takeProfit":
                    normalized_tp,

                "result":
                    serialize_value(
                        result
                    ),

                "pendingOrder":
                    serialize_pending_order(
                        pending_order
                    )
                    if pending_order
                    else None
            }), 200

        # --------------------------------------------------
        # FAILURE
        # --------------------------------------------------

        return jsonify({

            "success":
                False,

            "message":
                "MT5 rejected pending order.",

            "retcode":
                retcode_int,

            "result":
                serialize_value(
                    result
                ),

            "check":
                serialize_value(
                    check
                ),

            "request":
                serialize_value(
                    request_data
                ),

            "error":
                mt5_error()
        }), 400

    except Exception as error:

        print("")
        print(
            "❌ PENDING ORDER ERROR:",
            error
        )

        traceback.print_exc()

        return jsonify({
            "success": False,
            "message":
                "Failed to place MT5 pending order.",
            "error":
                str(error)
        }), 500


# ==========================================================
# GET ALL PENDING ORDERS
# GET /mt5/orders
# ==========================================================

@app.route(
    "/mt5/orders",
    methods=["GET"]
)
def get_pending_orders():
    try:

        if not ensure_mt5_connection():
            return jsonify({
                "success": False,
                "orders": [],
                "pendingOrders": [],
                "count": 0,
                "message":
                    "MT5 is not connected."
            }), 503

        orders = mt5.orders_get()

        if orders is None:
            return jsonify({
                "success": False,
                "orders": [],
                "pendingOrders": [],
                "count": 0,
                "message":
                    "Unable to fetch MT5 pending orders.",
                "error":
                    mt5_error()
            }), 500

        serialized_orders = []

        for order in orders:

            try:
                serialized = (
                    serialize_pending_order(
                        order
                    )
                )

                if serialized is not None:
                    serialized_orders.append(
                        serialized
                    )

            except Exception as error:
                print(
                    "⚠️ ORDER SERIALIZATION ERROR:",
                    error
                )

        print(
            f"📋 MT5 PENDING ORDERS: {len(serialized_orders)}"
        )

        return jsonify({

            "success":
                True,

            "count":
                len(serialized_orders),

            "orders":
                serialized_orders,

            "pendingOrders":
                serialized_orders
        }), 200

    except Exception as error:

        print(
            "❌ MT5 GET ORDERS ERROR:",
            error
        )

        traceback.print_exc()

        return jsonify({
            "success": False,
            "orders": [],
            "pendingOrders": [],
            "count": 0,
            "message":
                "Failed to fetch MT5 pending orders.",
            "error":
                str(error)
        }), 500


# ==========================================================
# GET SINGLE PENDING ORDER
# GET /mt5/order/<ticket>
# ==========================================================

@app.route(
    "/mt5/order/<int:ticket>",
    methods=["GET"]
)
def get_single_pending_order(ticket):

    try:

        if not ensure_mt5_connection():
            return jsonify({
                "success": False,
                "found": False,
                "message":
                    "MT5 is not connected."
            }), 503

        if ticket <= 0:
            return jsonify({
                "success": False,
                "found": False,
                "message":
                    "Invalid order ticket."
            }), 400

        order = (
            get_pending_order_by_ticket(
                ticket
            )
        )

        if order is None:
            return jsonify({
                "success": False,
                "found": False,
                "ticket":
                    ticket,
                "message":
                    "Pending order not found."
            }), 404

        serialized = (
            serialize_pending_order(
                order
            )
        )

        return jsonify({

            "success":
                True,

            "found":
                True,

            "ticket":
                ticket,

            "order":
                serialized,

            "pendingOrder":
                serialized
        }), 200

    except Exception as error:

        print(
            "❌ MT5 SINGLE ORDER ERROR:",
            error
        )

        traceback.print_exc()

        return jsonify({
            "success": False,
            "message":
                "Failed to fetch pending order.",
            "error":
                str(error)
        }), 500


# ==========================================================
# CANCEL PENDING ORDER
# POST /mt5/cancel-order
# ==========================================================

@app.route(
    "/mt5/cancel-order",
    methods=["POST"]
)
def cancel_pending_order():

    try:

        data = request.get_json(
            silent=True
        ) or {}

        ticket = (
            data.get("ticket")
            or data.get("orderId")
            or data.get("id")
        )

        if ticket is None:
            return jsonify({
                "success": False,
                "message":
                    "Pending order ticket is required."
            }), 400

        try:
            ticket = int(ticket)
        except Exception:
            return jsonify({
                "success": False,
                "message":
                    "Invalid pending order ticket."
            }), 400

        if ticket <= 0:
            return jsonify({
                "success": False,
                "message":
                    "Invalid pending order ticket."
            }), 400

        if not ensure_mt5_connection():
            return jsonify({
                "success": False,
                "message":
                    "MT5 is not connected."
            }), 503

        order = (
            get_pending_order_by_ticket(
                ticket
            )
        )

        if order is None:
            return jsonify({
                "success": False,
                "message":
                    "Pending order not found.",
                "ticket":
                    ticket
            }), 404

        request_data = {
            "action":
                mt5.TRADE_ACTION_REMOVE,

            "order":
                ticket
        }

        print("")
        print(
            "🗑️ MT5 CANCEL PENDING ORDER:",
            ticket
        )

        print(
            "REQUEST:",
            request_data
        )

        result = mt5.order_send(
            request_data
        )

        print(
            "CANCEL RESULT:",
            serialize_value(result)
        )

        if result is None:
            return jsonify({
                "success": False,
                "message":
                    "MT5 cancel request returned no result.",
                "error":
                    mt5_error()
            }), 500

        retcode = getattr(
            result,
            "retcode",
            None
        )

        retcode_int = (
            int(retcode)
            if retcode is not None
            else None
        )

        if retcode_int in (
            mt5.TRADE_RETCODE_DONE,
            mt5.TRADE_RETCODE_PLACED
        ):

            # Confirm removal.
            remaining = (
                get_pending_order_by_ticket(
                    ticket
                )
            )

            if remaining is None:

                print(
                    "✅ MT5 PENDING ORDER CANCELLED:",
                    ticket
                )

                return jsonify({
                    "success": True,
                    "message":
                        "Pending order cancelled successfully.",
                    "ticket":
                        ticket,
                    "retcode":
                        retcode_int,
                    "result":
                        serialize_value(
                            result
                        )
                }), 200

            print(
                "⚠️ Cancel returned success but order still exists."
            )

            return jsonify({
                "success": True,
                "message":
                    "Cancel request accepted by MT5.",
                "ticket":
                    ticket,
                "retcode":
                    retcode_int,
                "stillExists":
                    True,
                "result":
                    serialize_value(
                        result
                    )
            }), 200

        return jsonify({
            "success": False,
            "message":
                "MT5 rejected pending order cancellation.",
            "ticket":
                ticket,
            "retcode":
                retcode_int,
            "result":
                serialize_value(
                    result
                ),
            "error":
                mt5_error()
        }), 400

    except Exception as error:

        print(
            "❌ MT5 CANCEL ORDER ERROR:",
            error
        )

        traceback.print_exc()

        return jsonify({
            "success": False,
            "message":
                "Failed to cancel MT5 pending order.",
            "error":
                str(error)
        }), 500


# ==========================================================
# MODIFY PENDING ORDER
# POST /mt5/modify-order
# ==========================================================

@app.route(
    "/mt5/modify-order",
    methods=["POST"]
)
def modify_pending_order():

    try:

        data = request.get_json(
            silent=True
        ) or {}

        ticket = (
            data.get("ticket")
            or data.get("orderId")
            or data.get("id")
        )

        if ticket is None:
            return jsonify({
                "success": False,
                "message":
                    "Pending order ticket is required."
            }), 400

        try:
            ticket = int(ticket)
        except Exception:
            return jsonify({
                "success": False,
                "message":
                    "Invalid pending order ticket."
            }), 400

        if ticket <= 0:
            return jsonify({
                "success": False,
                "message":
                    "Invalid pending order ticket."
            }), 400

        if not ensure_mt5_connection():
            return jsonify({
                "success": False,
                "message":
                    "MT5 is not connected."
            }), 503

        order = (
            get_pending_order_by_ticket(
                ticket
            )
        )

        if order is None:
            return jsonify({
                "success": False,
                "message":
                    "Pending order not found.",
                "ticket":
                    ticket
            }), 404

        # --------------------------------------------------
        # ONLY REGULAR PENDING ORDERS
        # --------------------------------------------------

        order_type = getattr(
            order,
            "type",
            None
        )

        supported_modify_types = (
            mt5.ORDER_TYPE_BUY_LIMIT,
            mt5.ORDER_TYPE_SELL_LIMIT,
            mt5.ORDER_TYPE_BUY_STOP,
            mt5.ORDER_TYPE_SELL_STOP
        )

        if order_type not in supported_modify_types:
            return jsonify({
                "success": False,
                "message":
                    "Only BUY_LIMIT, SELL_LIMIT, BUY_STOP and SELL_STOP can be modified.",
                "ticket":
                    ticket
            }), 400

        symbol = str(
            getattr(
                order,
                "symbol",
                ""
            ) or ""
        ).upper().strip()

        # --------------------------------------------------
        # CURRENT VALUES
        # --------------------------------------------------

        current_price = float(
            getattr(
                order,
                "price_open",
                0
            ) or 0
        )

        current_sl = float(
            getattr(
                order,
                "sl",
                0
            ) or 0
        )

        current_tp = float(
            getattr(
                order,
                "tp",
                0
            ) or 0
        )

        # --------------------------------------------------
        # NEW ENTRY
        # --------------------------------------------------

        new_entry = (
            data.get("entry")
            if data.get("entry")
            not in (None, "")
            else data.get("price")
        )

        if new_entry in (
            None,
            ""
        ):
            new_entry = current_price

        try:
            new_entry = float(
                new_entry
            )
        except Exception:
            return jsonify({
                "success": False,
                "message":
                    "Invalid pending order entry price."
            }), 400

        if new_entry <= 0:
            return jsonify({
                "success": False,
                "message":
                    "Entry price must be greater than zero."
            }), 400

        new_entry = normalize_price(
            symbol,
            new_entry
        )

        # --------------------------------------------------
        # NEW SL
        # --------------------------------------------------

        if (
            "stopLoss" in data
            or "sl" in data
        ):

            new_sl = (
                data.get("stopLoss")
                if "stopLoss" in data
                else data.get("sl")
            )

            if new_sl in (
                None,
                "",
                0,
                "0"
            ):
                new_sl = 0.0

            else:
                try:
                    new_sl = float(
                        new_sl
                    )
                except Exception:
                    return jsonify({
                        "success": False,
                        "message":
                            "Invalid Stop Loss."
                    }), 400

                if new_sl <= 0:
                    return jsonify({
                        "success": False,
                        "message":
                            "Invalid Stop Loss."
                    }), 400

                new_sl = normalize_price(
                    symbol,
                    new_sl
                )

        else:
            new_sl = current_sl

        # --------------------------------------------------
        # NEW TP
        # --------------------------------------------------

        if (
            "takeProfit" in data
            or "tp" in data
        ):

            new_tp = (
                data.get("takeProfit")
                if "takeProfit" in data
                else data.get("tp")
            )

            if new_tp in (
                None,
                "",
                0,
                "0"
            ):
                new_tp = 0.0

            else:
                try:
                    new_tp = float(
                        new_tp
                    )
                except Exception:
                    return jsonify({
                        "success": False,
                        "message":
                            "Invalid Take Profit."
                    }), 400

                if new_tp <= 0:
                    return jsonify({
                        "success": False,
                        "message":
                            "Invalid Take Profit."
                    }), 400

                new_tp = normalize_price(
                    symbol,
                    new_tp
                )

        else:
            new_tp = current_tp

        # --------------------------------------------------
        # MARKET VALIDATION
        # --------------------------------------------------

        tick = mt5.symbol_info_tick(
            symbol
        )

        if tick is not None:

            bid = float(
                getattr(
                    tick,
                    "bid",
                    0
                ) or 0
            )

            ask = float(
                getattr(
                    tick,
                    "ask",
                    0
                ) or 0
            )

            if (
                order_type ==
                mt5.ORDER_TYPE_BUY_LIMIT
                and ask > 0
                and new_entry >= ask
            ):
                return jsonify({
                    "success": False,
                    "message":
                        "BUY LIMIT entry must be below current Ask.",
                    "entry":
                        new_entry,
                    "currentAsk":
                        ask
                }), 400

            if (
                order_type ==
                mt5.ORDER_TYPE_SELL_LIMIT
                and bid > 0
                and new_entry <= bid
            ):
                return jsonify({
                    "success": False,
                    "message":
                        "SELL LIMIT entry must be above current Bid.",
                    "entry":
                        new_entry,
                    "currentBid":
                        bid
                }), 400

            if (
                order_type ==
                mt5.ORDER_TYPE_BUY_STOP
                and ask > 0
                and new_entry <= ask
            ):
                return jsonify({
                    "success": False,
                    "message":
                        "BUY STOP entry must be above current Ask.",
                    "entry":
                        new_entry,
                    "currentAsk":
                        ask
                }), 400

            if (
                order_type ==
                mt5.ORDER_TYPE_SELL_STOP
                and bid > 0
                and new_entry >= bid
            ):
                return jsonify({
                    "success": False,
                    "message":
                        "SELL STOP entry must be below current Bid.",
                    "entry":
                        new_entry,
                    "currentBid":
                        bid
                }), 400

        # --------------------------------------------------
        # MODIFY REQUEST
        # --------------------------------------------------

        request_data = {
            "action":
                mt5.TRADE_ACTION_MODIFY,

            "order":
                ticket,

            "price":
                new_entry,

            "sl":
                new_sl,

            "tp":
                new_tp
        }

        print("")
        print(
            "✏️ MT5 MODIFY PENDING ORDER"
        )

        print(
            "Ticket:",
            ticket
        )

        print(
            "Symbol:",
            symbol
        )

        print(
            "Old Entry:",
            current_price
        )

        print(
            "New Entry:",
            new_entry
        )

        print(
            "Old SL:",
            current_sl
        )

        print(
            "New SL:",
            new_sl
        )

        print(
            "Old TP:",
            current_tp
        )

        print(
            "New TP:",
            new_tp
        )

        print(
            "REQUEST:",
            request_data
        )

        # --------------------------------------------------
        # ORDER CHECK
        # --------------------------------------------------

        check = mt5.order_check(
            request_data
        )

        print(
            "MODIFY CHECK:",
            serialize_value(check)
        )

        if check is None:
            return jsonify({
                "success": False,
                "message":
                    "MT5 modify order check returned no result.",
                "error":
                    mt5_error()
            }), 400

        check_retcode = getattr(
            check,
            "retcode",
            None
        )

        if (
            check_retcode is not None
            and int(check_retcode) != 0
        ):
            return jsonify({
                "success": False,
                "message":
                    "MT5 rejected pending order modification during check.",
                "retcode":
                    int(check_retcode),
                "check":
                    serialize_value(check),
                "request":
                    serialize_value(request_data)
            }), 400

        # --------------------------------------------------
        # SEND
        # --------------------------------------------------

        result = mt5.order_send(
            request_data
        )

        print(
            "MODIFY RESULT:",
            serialize_value(result)
        )

        if result is None:
            return jsonify({
                "success": False,
                "message":
                    "MT5 modify request returned no result.",
                "error":
                    mt5_error()
            }), 500

        retcode = getattr(
            result,
            "retcode",
            None
        )

        retcode_int = (
            int(retcode)
            if retcode is not None
            else None
        )

        if retcode_int in (
            mt5.TRADE_RETCODE_DONE,
            mt5.TRADE_RETCODE_PLACED
        ):

            updated_order = (
                get_pending_order_by_ticket(
                    ticket
                )
            )

            print(
                "✅ MT5 PENDING ORDER MODIFIED:",
                ticket
            )

            return jsonify({

                "success":
                    True,

                "message":
                    "Pending order modified successfully.",

                "ticket":
                    ticket,

                "order":
                    ticket,

                "retcode":
                    retcode_int,

                "entry":
                    new_entry,

                "price":
                    new_entry,

                "stopLoss":
                    new_sl,

                "takeProfit":
                    new_tp,

                "result":
                    serialize_value(
                        result
                    ),

                "pendingOrder":
                    serialize_pending_order(
                        updated_order
                    )
                    if updated_order
                    else None
            }), 200

        return jsonify({

            "success":
                False,

            "message":
                "MT5 rejected pending order modification.",

            "ticket":
                ticket,

            "retcode":
                retcode_int,

            "result":
                serialize_value(
                    result
                ),

            "check":
                serialize_value(
                    check
                ),

            "error":
                mt5_error()
        }), 400

    except Exception as error:

        print(
            "❌ MT5 MODIFY ORDER ERROR:",
            error
        )

        traceback.print_exc()

        return jsonify({
            "success": False,
            "message":
                "Failed to modify MT5 pending order.",
            "error":
                str(error)
        }), 500


# ==========================================================
# HISTORY
# GET /mt5/history
#
# Reconciliation read contract:
#   * the caller must state the MT5 login AND server it expects
#   * the bridge never initializes, switches or reconnects here
#   * verified empty, failed and incomplete are three different answers
#   * every broker identifier is a string and every volume is decimal
# ==========================================================

HISTORY_MAX_PAGE_DAYS = 365

HISTORY_MIN_UTC = datetime(1970, 1, 1, tzinfo=timezone.utc)

HISTORY_MAX_UTC = datetime(2200, 1, 1, tzinfo=timezone.utc)

HISTORY_DEAL_REQUIRED_FIELDS = (
    "ticket",
    "order",
    "position_id",
    "symbol",
    "type",
    "entry",
    "volume",
    "price",
    "profit",
    "commission",
    "swap",
    "fee",
    "time",
    "time_msc",
    "comment",
    "magic",
)

HISTORY_POSITION_REQUIRED_FIELDS = (
    "ticket",
    "identifier",
    "symbol",
    "type",
    "volume",
)

# DEAL_TYPE_BUY / DEAL_TYPE_SELL: these open or close a position.
HISTORY_TRADE_DEAL_TYPES = (
    0,
    1,
)

# DEAL_TYPE_BALANCE, DEAL_TYPE_CREDIT, DEAL_TYPE_CURRENCY_BUY and
# DEAL_TYPE_CURRENCY_SELL: real broker records that carry no position.
HISTORY_FINANCIAL_DEAL_TYPES = (
    2,
    3,
    4,
    5,
)

HISTORY_DEAL_TYPES = (
    HISTORY_TRADE_DEAL_TYPES
    + HISTORY_FINANCIAL_DEAL_TYPES
)


class HistoryQueryError(Exception):
    """
    A request the bridge must refuse before touching MT5.
    """

    def __init__(self, code, message):
        super().__init__(message)

        self.code = code
        self.message = message


class MalformedBrokerRecord(Exception):
    """
    A broker record the bridge cannot hand over exactly as reported.
    """

    pass


class HistoryScanInterrupted(Exception):
    """
    A reconciliation page that must stop where it is.

    Raised by the guarded reads: the scan's generation, identity, or a native
    call made the page untrustworthy, so nothing is handed over.
    """

    def __init__(self, status, code, message):
        super().__init__(message)

        self.status = status
        self.code = code
        self.message = message


def history_failure(status, code, message):
    return jsonify(
        {
            "success": False,
            "page_query_complete": False,
            "history": None,
            "positions": None,
            "code": code,
            "message": message,
        }
    ), status


def parse_history_utc(value):
    """
    Parse an exact UTC timestamp.

    Only 'YYYY-MM-DDTHH:MM:SSZ' (optionally to millisecond precision) is
    accepted. Naive timestamps, offsets and sub-millisecond values are refused
    rather than guessed: a wrong second silently drops deals.
    """

    if not isinstance(value, str):
        raise HistoryQueryError(
            "INVALID_HISTORY_QUERY",
            "Timestamps must be UTC ISO-8601 strings ending in Z"
        )

    text = value.strip()

    if not text.endswith("Z"):
        raise HistoryQueryError(
            "INVALID_HISTORY_QUERY",
            f"{value!r} is not a UTC timestamp ending in Z"
        )

    try:
        parsed = datetime.fromisoformat(text[:-1])
    except ValueError:
        raise HistoryQueryError(
            "INVALID_HISTORY_QUERY",
            f"{value!r} is not an ISO-8601 timestamp"
        )

    if parsed.tzinfo is not None:
        raise HistoryQueryError(
            "INVALID_HISTORY_QUERY",
            f"{value!r} must not carry a UTC offset"
        )

    if parsed.microsecond % 1000 != 0:
        raise HistoryQueryError(
            "INVALID_HISTORY_QUERY",
            f"{value!r} is more precise than one millisecond"
        )

    moment = parsed.replace(tzinfo=timezone.utc)

    if not (HISTORY_MIN_UTC <= moment <= HISTORY_MAX_UTC):
        raise HistoryQueryError(
            "INVALID_HISTORY_QUERY",
            f"{value!r} is outside the supported history range"
        )

    return moment


def canonical_utc(moment):
    return moment.isoformat().replace("+00:00", "Z")


def parse_decimal_digits(value):
    """
    Parse an integer written with ASCII digits only, or return None.

    str.isdigit() also accepts Arabic-Indic digits, which int() silently
    converts into a different number, and superscripts, which make int() raise
    straight out of the query parser and answer with an HTML 500 instead of the
    JSON refusal contract.
    """

    if not isinstance(value, str) or not value:
        return None

    if any(character not in "0123456789" for character in value):
        return None

    try:
        return int(value)

    except ValueError:
        # Only reachable past CPython's integer conversion limit.
        return None


def parse_history_login(value):
    """
    Digits only, leading zeros allowed, zero refused.

    There is deliberately no fallback to accountId, a display name, or the
    currently connected login: a request without an explicit login is never
    answered.
    """

    if not isinstance(value, str):
        raise HistoryQueryError(
            "INVALID_HISTORY_QUERY",
            "expected_mt5_login is required"
        )

    number = parse_decimal_digits(value.strip())

    if number is None:
        raise HistoryQueryError(
            "INVALID_HISTORY_QUERY",
            "expected_mt5_login must be a positive MT5 login number"
        )

    if number <= 0:
        raise HistoryQueryError(
            "INVALID_HISTORY_QUERY",
            "expected_mt5_login must be a positive MT5 login number"
        )

    return str(number)


def parse_history_server(value):
    if not isinstance(value, str):
        raise HistoryQueryError(
            "INVALID_HISTORY_QUERY",
            "expected_mt5_server is required"
        )

    text = value.strip().lower()

    if not text:
        raise HistoryQueryError(
            "INVALID_HISTORY_QUERY",
            "expected_mt5_server is required"
        )

    if any(ord(character) < 32 for character in text):
        raise HistoryQueryError(
            "INVALID_HISTORY_QUERY",
            "expected_mt5_server is not a valid server name"
        )

    return text


def single_argument(args, name):
    values = args.getlist(name)

    if len(values) > 1:
        raise HistoryQueryError(
            "INVALID_HISTORY_QUERY",
            f"{name} must appear exactly once"
        )

    if not values:
        return None

    return values[0]


def parse_history_query(args):
    """
    Validate the whole request without touching MT5.
    """

    login = parse_history_login(
        single_argument(args, "expected_mt5_login")
    )

    server = parse_history_server(
        single_argument(args, "expected_mt5_server")
    )

    date_from = parse_history_utc(
        single_argument(args, "from_utc")
    )

    date_to = parse_history_utc(
        single_argument(args, "to_utc")
    )

    if date_to <= date_from:
        raise HistoryQueryError(
            "INVALID_HISTORY_QUERY",
            "to_utc must be after from_utc"
        )

    if date_to - date_from > timedelta(days=HISTORY_MAX_PAGE_DAYS):
        raise HistoryQueryError(
            "INVALID_HISTORY_QUERY",
            f"A history page may not exceed {HISTORY_MAX_PAGE_DAYS} days"
        )

    scan_from = date_from
    scan_to = date_to

    raw_scan_from = single_argument(args, "scan_from_utc")
    raw_scan_to = single_argument(args, "scan_to_utc")

    if raw_scan_from is not None:
        scan_from = parse_history_utc(raw_scan_from)

    if raw_scan_to is not None:
        scan_to = parse_history_utc(raw_scan_to)

    if scan_to < scan_from:
        raise HistoryQueryError(
            "INVALID_HISTORY_QUERY",
            "scan_to_utc must not be before scan_from_utc"
        )

    boot_id = single_argument(args, "bridge_boot_id")
    raw_generation = single_argument(args, "connection_generation")

    continuation = None

    if boot_id is not None or raw_generation is not None:
        if boot_id is None or raw_generation is None:
            raise HistoryQueryError(
                "INVALID_HISTORY_QUERY",
                "bridge_boot_id and connection_generation "
                "must be sent together"
            )

        generation = parse_decimal_digits(raw_generation)

        if generation is None:
            raise HistoryQueryError(
                "INVALID_HISTORY_QUERY",
                "connection_generation must be a non-negative integer"
            )

        continuation = (boot_id, generation)

    return {
        "login": login,
        "server": server,
        "from_utc": date_from,
        "to_utc": date_to,
        "scan_from_utc": scan_from,
        "scan_to_utc": scan_to,
        "continuation": continuation,
    }


def connected_mt5_identity():
    """
    Read the identity the terminal actually reports.

    Returns ('ok', login, server) or a refusal reason. No connection is opened
    and none is repaired here.
    """

    terminal = mt5.terminal_info()

    account = mt5.account_info()

    if terminal is None or account is None:
        return ("MT5_NOT_CONNECTED", None, None)

    login = getattr(account, "login", None)
    server = getattr(account, "server", None)

    login_text = str(login).strip() if login is not None else ""
    server_text = str(server).strip() if server is not None else ""

    login_number = parse_decimal_digits(login_text)

    if login_number is None or login_number <= 0 or not server_text:
        return ("MT5_IDENTITY_UNAVAILABLE", None, None)

    return ("ok", str(login_number), server_text.lower())


def history_decimal(value):
    """
    Exact decimal string; floats go through their shortest repr.
    """

    if isinstance(value, bool) or value is None:
        raise MalformedBrokerRecord(
            f"{value!r} is not a number"
        )

    if isinstance(value, Decimal):
        number = value
    elif isinstance(value, int):
        number = Decimal(value)
    elif isinstance(value, float):
        if not math.isfinite(value):
            raise MalformedBrokerRecord(
                f"{value!r} is not a finite number"
            )

        number = Decimal(str(value))
    else:
        raise MalformedBrokerRecord(
            f"{value!r} is not a number"
        )

    if not number.is_finite():
        raise MalformedBrokerRecord(
            f"{value!r} is not a finite number"
        )

    text = format(number.normalize(), "f")

    if text == "-0":
        text = "0"

    return text


def history_identifier(value, name):
    """
    Broker identifiers become strings: they can exceed JavaScript's safe
    integer range, and a rounded ticket cannot be reconciled.
    """

    if isinstance(value, bool) or not isinstance(value, int):
        raise MalformedBrokerRecord(
            f"{name} must be an integer"
        )

    if value < 0:
        raise MalformedBrokerRecord(
            f"{name} must not be negative"
        )

    return str(value)


def history_small_int(value, name, maximum=None):
    if isinstance(value, bool) or not isinstance(value, int):
        raise MalformedBrokerRecord(
            f"{name} must be an integer"
        )

    if value < 0:
        raise MalformedBrokerRecord(
            f"{name} must not be negative"
        )

    if maximum is not None and value > maximum:
        raise MalformedBrokerRecord(
            f"{name} must not exceed {maximum}"
        )

    return value


def positive_int(value, name):
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise MalformedBrokerRecord(
            f"{name} must be a positive integer"
        )

    return value


def json_safe(value, path):
    """
    Strict JSON-safety oracle.

    Anything the bridge cannot hand over exactly (an arbitrary object, NaN, an
    exotic type) fails the batch instead of being str()-coerced, because a
    silently mangled field would corrupt reconciliation downstream.
    """

    if value is None or isinstance(value, bool):
        return value

    if isinstance(value, int):
        return str(value)

    if isinstance(value, float):
        if not math.isfinite(value):
            raise MalformedBrokerRecord(
                f"{path} is not a finite number"
            )

        return history_decimal(value)

    if isinstance(value, Decimal):
        return history_decimal(value)

    if isinstance(value, str):
        return value

    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, dict):
        return {
            str(key): json_safe(item, f"{path}.{key}")
            for key, item in value.items()
        }

    if isinstance(value, (list, tuple)):
        return [
            json_safe(item, f"{path}[{index}]")
            for index, item in enumerate(value)
        ]

    raise MalformedBrokerRecord(
        f"{path} has unsupported type {type(value).__name__}"
    )


def record_fields(record, error_label):
    """
    Return a field mapping for a broker record, or refuse.
    """

    if isinstance(record, dict):
        return dict(record)

    as_dict = getattr(record, "_asdict", None)

    if not callable(as_dict):
        raise MalformedBrokerRecord(
            f"{error_label} has type {type(record).__name__}"
        )

    try:
        fields = as_dict()
    except Exception as error:
        raise MalformedBrokerRecord(
            f"{error_label} cannot be serialized: {error}"
        )

    if not isinstance(fields, dict):
        raise MalformedBrokerRecord(
            f"{error_label} _asdict() did not return a mapping"
        )

    return dict(fields)


def require_fields(fields, required):
    missing = [
        name
        for name in required
        if name not in fields
    ]

    if missing:
        raise MalformedBrokerRecord(
            f"missing fields: {', '.join(missing)}"
        )


def validate_history_deal(fields, from_ms, to_ms):
    """
    Validate one deal exactly as the broker reported it.

    Nothing is repaired: an unusable record fails the page, because a partial
    scan can never prove that a position closed.
    """

    require_fields(
        fields,
        HISTORY_DEAL_REQUIRED_FIELDS
    )

    deal_type = history_small_int(
        fields["type"],
        "type"
    )

    if deal_type not in HISTORY_DEAL_TYPES:
        raise MalformedBrokerRecord(
            f"unsupported deal type {deal_type}"
        )

    entry = history_small_int(
        fields["entry"],
        "entry",
        maximum=3
    )

    ticket = history_identifier(fields["ticket"], "ticket")

    if ticket == "0":
        raise MalformedBrokerRecord(
            "deal ticket must not be zero"
        )

    order = history_identifier(fields["order"], "order")

    position_id = history_identifier(
        fields["position_id"],
        "position_id"
    )

    symbol = fields["symbol"]

    if not isinstance(symbol, str):
        raise MalformedBrokerRecord(
            "symbol must be a string"
        )

    volume = history_decimal(fields["volume"])

    price = history_decimal(fields["price"])

    profit = history_decimal(fields["profit"])

    commission = history_decimal(fields["commission"])

    swap = history_decimal(fields["swap"])

    fee = history_decimal(fields["fee"])

    if float(volume) < 0:
        raise MalformedBrokerRecord(
            "volume must not be negative"
        )

    if float(price) < 0:
        raise MalformedBrokerRecord(
            "price must not be negative"
        )

    # A financial deal is handed over as evidence exactly as reported: it has
    # no position, no volume and no symbol, so the trade rules must not judge
    # it, and downstream must not read it as a closed position.
    if deal_type in HISTORY_TRADE_DEAL_TYPES:
        if position_id == "0":
            raise MalformedBrokerRecord(
                "a trade deal must reference a position"
            )

        if float(volume) <= 0:
            raise MalformedBrokerRecord(
                "a trade deal must have a positive volume"
            )

        if not symbol:
            raise MalformedBrokerRecord(
                "a trade deal must have a symbol"
            )

    moment = history_small_int(fields["time"], "time")

    time_msc = history_small_int(fields["time_msc"], "time_msc")

    if time_msc // 1000 != moment:
        raise MalformedBrokerRecord(
            "time and time_msc disagree"
        )

    if not (from_ms <= time_msc <= to_ms):
        raise MalformedBrokerRecord(
            "deal is outside the requested page"
        )

    comment = fields["comment"]

    if not isinstance(comment, str):
        raise MalformedBrokerRecord(
            "comment must be a string"
        )

    magic = history_small_int(fields["magic"], "magic")

    raw = json_safe(fields, "deal")

    return {
        "ticket": ticket,
        "order": order,
        "position_id": position_id,
        "symbol": symbol,
        "type": deal_type,
        "entry": entry,
        "volume": volume,
        "price": price,
        "profit": profit,
        "commission": commission,
        "swap": swap,
        "fee": fee,
        "time": moment,
        "time_msc": time_msc,
        "comment": comment,
        "magic": magic,
        "raw": raw,
    }


def validate_live_position(fields):
    """
    A live position is reported as-is, with its stable identifier kept apart
    from the execution ticket.
    """

    require_fields(
        fields,
        HISTORY_POSITION_REQUIRED_FIELDS
    )

    ticket = positive_int(fields["ticket"], "position ticket")

    identifier = positive_int(
        fields["identifier"],
        "position identifier"
    )

    symbol = fields["symbol"]

    if not isinstance(symbol, str) or not symbol:
        raise MalformedBrokerRecord(
            "position symbol must be a non-empty string"
        )

    deal_type = history_small_int(
        fields["type"],
        "position type"
    )

    volume = history_decimal(fields["volume"])

    if float(volume) <= 0:
        raise MalformedBrokerRecord(
            "position volume must be positive"
        )

    return {
        "ticket": str(ticket),
        "position_id": str(identifier),
        "identifier": str(identifier),
        "symbol": symbol,
        "type": deal_type,
        "volume": volume,
        "raw": json_safe(fields, "position"),
    }


def collect_history_page(deals, from_utc, to_utc):
    """
    Validate and serialize the whole page, or refuse it.

    Identical duplicates are preserved, conflicting duplicates are refused: a
    broker that reports the same ticket twice with different contents cannot
    tell us which P&L was real.
    """

    if deals is None:
        return None

    if not isinstance(deals, (list, tuple)):
        raise MalformedBrokerRecord(
            f"history is {type(deals).__name__}, not a collection"
        )

    from_ms = int(from_utc.timestamp()) * 1000
    to_ms = int(to_utc.timestamp()) * 1000

    history = []
    signatures = {}

    for index, deal in enumerate(deals):
        try:
            row = validate_history_deal(
                record_fields(deal, f"deal {index}"),
                from_ms,
                to_ms
            )
        except MalformedBrokerRecord as error:
            raise MalformedBrokerRecord(
                f"deal {index}: {error}"
            )

        signature = json.dumps(
            row["raw"],
            sort_keys=True,
            separators=(",", ":")
        )

        previous = signatures.get(row["ticket"])

        if previous is not None and previous != signature:
            raise MalformedBrokerRecord(
                f"deal ticket {row['ticket']} appears twice with "
                "different contents"
            )

        signatures[row["ticket"]] = signature

        history.append(row)

    return history


def collect_live_positions(positions):
    if positions is None:
        return None

    if not isinstance(positions, (list, tuple)):
        raise MalformedBrokerRecord(
            f"positions is {type(positions).__name__}, not a collection"
        )

    rows = []
    identifiers = {}

    for index, position in enumerate(positions):
        try:
            row = validate_live_position(
                record_fields(position, f"position {index}")
            )
        except MalformedBrokerRecord as error:
            raise MalformedBrokerRecord(
                f"position {index}: {error}"
            )

        previous = identifiers.get(row["identifier"])

        if previous is not None and previous != row["ticket"]:
            raise MalformedBrokerRecord(
                f"position identifier {row['identifier']} maps to more "
                "than one ticket"
            )

        identifiers[row["identifier"]] = row["ticket"]

        rows.append(row)

    return rows


def history_hold(query, generation, stage):
    """
    Re-verify a scan's right to continue, with MT5_CONNECTION_LOCK held.

    The generation is checked before the identity: a connection mutation that
    lands between two guarded reads must strand the page as
    MT5_CONNECTION_CHANGED, not be reported as an identity problem. On the
    first hold generation is None, so the scan adopts the live counter and
    validates any continuation token against it.

    Returns (generation, login, server).
    """

    if generation is None:
        generation = CONNECTION_GENERATION

        continuation = query["continuation"]

        if continuation is not None and (
            continuation[0] != BRIDGE_BOOT_ID
            or continuation[1] != generation
        ):
            raise HistoryScanInterrupted(
                409,
                "MT5_CONNECTION_CHANGED",
                "The MT5 connection changed since this scan started."
            )

    elif CONNECTION_GENERATION != generation:
        raise HistoryScanInterrupted(
            409,
            "MT5_CONNECTION_CHANGED",
            f"The MT5 connection changed during the {stage} read."
        )

    state, login, server = connected_mt5_identity()

    if state != "ok":
        raise HistoryScanInterrupted(
            503,
            state,
            "MT5 has no confirmed connected identity."
            if state == "MT5_IDENTITY_UNAVAILABLE"
            else "MT5 is not connected."
        )

    if login != query["login"] or server != query["server"]:
        raise HistoryScanInterrupted(
            409,
            "MT5_IDENTITY_MISMATCH",
            f"The connected MT5 account is not the requested one ({stage})."
        )

    return generation, login, server


def guarded_mt5_read(
    query,
    generation,
    stage,
    read,
    failure_code,
    failure_message,
):
    """
    Run one native MT5 call while the connection lock is held.

    Nothing else stays in the critical section. Validating and serializing a
    full page happens outside the lock, so a long reconciliation can no longer
    make every other MT5 endpoint wait for it, and no native call is ever
    reached without the lock. Each hold checks the generation and identity
    before and after the call, which is what allows a mutation to run in the
    gap between reads without the page mixing two accounts together.

    Returns (value, generation, login, server).
    """

    with MT5_CONNECTION_LOCK:
        generation, login, server = history_hold(
            query,
            generation,
            stage
        )

        try:
            value = read()

        except Exception as error:
            raise HistoryScanInterrupted(
                503,
                failure_code,
                f"{failure_message}: {error}"
            )

        generation, login, server = history_hold(
            query,
            generation,
            stage
        )

    return value, generation, login, server


def run_history_scan(query):
    """
    Collect one verified history page, or refuse it.
    """

    deals, generation, _, _ = guarded_mt5_read(
        query=query,
        generation=None,
        stage="history",
        read=lambda: mt5.history_deals_get(
            query["from_utc"],
            query["to_utc"]
        ),
        failure_code="MT5_HISTORY_READ_FAILED",
        failure_message="MT5 history read failed",
    )

    try:
        history = collect_history_page(
            deals,
            query["from_utc"],
            query["to_utc"]
        )

    except MalformedBrokerRecord as error:
        raise HistoryScanInterrupted(
            502,
            "MALFORMED_HISTORY",
            f"MT5 returned an unusable history page: {error}"
        )

    if history is None:
        raise HistoryScanInterrupted(
            503,
            "MT5_HISTORY_READ_FAILED",
            "MT5 returned no history page."
        )

    positions, generation, login, server = guarded_mt5_read(
        query=query,
        generation=generation,
        stage="positions",
        read=mt5.positions_get,
        failure_code="MT5_POSITIONS_READ_FAILED",
        failure_message="MT5 positions read failed",
    )

    try:
        live_positions = collect_live_positions(positions)

    except MalformedBrokerRecord as error:
        raise HistoryScanInterrupted(
            502,
            "MALFORMED_POSITIONS",
            f"MT5 returned unusable open positions: {error}"
        )

    if live_positions is None:
        raise HistoryScanInterrupted(
            503,
            "MT5_POSITIONS_READ_FAILED",
            "MT5 returned no position list."
        )

    return {
        "success": True,
        "page_query_complete": True,
        "source_scan_complete": False,
        "identity": {
            "mt5Login": login,
            "mt5Server": server,
        },
        "utc_range": {
            "from_utc": canonical_utc(query["from_utc"]),
            "to_utc": canonical_utc(query["to_utc"]),
        },
        "scan_range": {
            "from_utc": canonical_utc(query["scan_from_utc"]),
            "to_utc": canonical_utc(query["scan_to_utc"]),
        },
        "coverage": {
            "boundaries": "inclusive",
            "returned_deal_count": len(deals),
            "serialized_deal_count": len(history),
        },
        "retention_verified": False,
        "bridge_boot_id": BRIDGE_BOOT_ID,
        "connection_generation": generation,
        "count": len(history),
        "history": history,
        "positions": live_positions,
    }


@app.route(
    "/mt5/history",
    methods=["GET"]
)
def mt5_history():

    try:
        query = parse_history_query(request.args)

        return jsonify(run_history_scan(query))

    except HistoryQueryError as error:
        return history_failure(400, error.code, error.message)

    except HistoryScanInterrupted as error:
        return history_failure(
            error.status,
            error.code,
            error.message
        )

    except Exception as error:
        traceback.print_exc()

        return history_failure(
            500,
            "MT5_HISTORY_READ_FAILED",
            f"Unexpected MT5 history error: {error}"
        )


# ==========================================================
# CLOSE POSITION
# POST /mt5/close-position
# ==========================================================

@app.route(
    "/mt5/close-position",
    methods=["POST"]
)
def close_position():

    try:

        data = request.get_json(
            silent=True
        ) or {}

        ticket = data.get(
            "ticket"
        )

        requested_volume = data.get(
            "volume"
        )

        if ticket is None:
            return jsonify({
                "success": False,
                "message":
                    "Position ticket is required."
            }), 400

        try:
            ticket = int(ticket)
        except Exception:
            return jsonify({
                "success": False,
                "message":
                    "Invalid position ticket."
            }), 400

        if ticket <= 0:
            return jsonify({
                "success": False,
                "message":
                    "Invalid position ticket."
            }), 400

        if not ensure_mt5_connection():
            return jsonify({
                "success": False,
                "message":
                    "MT5 is not connected."
            }), 503

        positions = mt5.positions_get(
            ticket=ticket
        )

        if not positions:
            return jsonify({
                "success": False,
                "message":
                    "Position not found.",
                "ticket":
                    ticket
            }), 404

        position = positions[0]

        symbol = str(
            getattr(
                position,
                "symbol",
                ""
            ) or ""
        ).upper()

        position_volume = float(
            getattr(
                position,
                "volume",
                0
            ) or 0
        )

        position_type = getattr(
            position,
            "type",
            None
        )

        if requested_volume in (
            None,
            "",
            0,
            "0"
        ):
            close_volume = position_volume

        else:

            try:
                close_volume = float(
                    requested_volume
                )

            except Exception:
                return jsonify({
                    "success": False,
                    "message":
                        "Invalid close volume."
                }), 400

        close_volume = normalize_volume(
            symbol,
            close_volume
        )

        if close_volume is None:
            return jsonify({
                "success": False,
                "message":
                    "Unable to normalize close volume."
            }), 400

        if close_volume > position_volume:
            close_volume = position_volume

        tick = mt5.symbol_info_tick(
            symbol
        )

        if tick is None:
            return jsonify({
                "success": False,
                "message":
                    "Unable to fetch closing price."
            }), 500

        # To close BUY, send SELL.
        if position_type == mt5.POSITION_TYPE_BUY:

            close_type = (
                mt5.ORDER_TYPE_SELL
            )

            close_price = float(
                tick.bid or 0
            )

        else:

            close_type = (
                mt5.ORDER_TYPE_BUY
            )

            close_price = float(
                tick.ask or 0
            )

        close_price = normalize_price(
            symbol,
            close_price
        )

        filling_modes = get_filling_modes(
            symbol
        )

        last_result = None

        for filling_mode in filling_modes:

            request_data = {

                "action":
                    mt5.TRADE_ACTION_DEAL,

                "symbol":
                    symbol,

                "volume":
                    close_volume,

                "type":
                    close_type,

                "position":
                    ticket,

                "price":
                    close_price,

                "deviation":
                    50,

                "magic":
                    EDGEFLO_MAGIC,

                "comment":
                    "EdgeFlo Close",

                "type_time":
                    mt5.ORDER_TIME_GTC,

                "type_filling":
                    filling_mode
            }

            print("")
            print(
                "🔴 MT5 CLOSE POSITION"
            )

            print(
                "Ticket:",
                ticket
            )

            print(
                "Symbol:",
                symbol
            )

            print(
                "Volume:",
                close_volume
            )

            print(
                "Price:",
                close_price
            )

            print(
                "Filling:",
                filling_mode
            )

            check = mt5.order_check(
                request_data
            )

            print(
                "CLOSE CHECK:",
                serialize_value(check)
            )

            if check is not None:

                check_retcode = getattr(
                    check,
                    "retcode",
                    None
                )

                if (
                    check_retcode is not None
                    and int(check_retcode)
                    == mt5.TRADE_RETCODE_INVALID_FILL
                ):
                    continue

            result = mt5.order_send(
                request_data
            )

            last_result = result

            print(
                "CLOSE RESULT:",
                serialize_value(result)
            )

            if result is None:
                continue

            retcode = getattr(
                result,
                "retcode",
                None
            )

            if retcode is None:
                continue

            retcode = int(
                retcode
            )

            if is_success_retcode(retcode):

                print(
                    "✅ MT5 POSITION CLOSE SUCCESS"
                )

                # --------------------------------------------------
                # GET ACTUAL MT5 CLOSE DEAL TIME
                # --------------------------------------------------

                deal_ticket = getattr(
                    result,
                    "deal",
                    None
                )

                close_deal = None
                close_time_msc = None
                closed_at = None

                if deal_ticket:

                    try:

                        deals = None

                        # MT5 history can take a moment to update
                        for _ in range(10):

                            deals = mt5.history_deals_get(
                                ticket=int(deal_ticket)
                            )

                            if deals:
                                break

                            time.sleep(0.2)

                        if deals:

                            close_deal = deals[0]

                            close_time_msc = getattr(
                                close_deal,
                                "time_msc",
                                None
                            )

                            # Fallback if time_msc is unavailable
                            if close_time_msc is None:

                                close_time = getattr(
                                    close_deal,
                                    "time",
                                    None
                                )

                                if close_time is not None:

                                    close_time_msc = (
                                        int(close_time) * 1000
                                    )

                            if close_time_msc:

                                closed_at = (
                                    datetime.fromtimestamp(
                                        close_time_msc / 1000,
                                        tz=timezone.utc
                                    )
                                    .isoformat()
                                    .replace(
                                        "+00:00",
                                        "Z"
                                    )
                                )

                    except Exception as history_error:

                        print(
                            "⚠️ Could not fetch MT5 close deal:",
                            history_error
                        )

                print(
                    "📌 CLOSE DEAL:",
                    deal_ticket
                )

                print(
                    "📌 CLOSE TIME MSC:",
                    close_time_msc
                )

                print(
                    "📌 CLOSED AT:",
                    closed_at
                )

                return jsonify({

                    "success":
                        True,

                    "message":
                        "MT5 position closed successfully.",

                    "ticket":
                        ticket,

                    "volume":
                        close_volume,

                    "retcode":
                        retcode,

                    "deal":
                        deal_ticket,

                    "closeTimeMsc":
                        close_time_msc,

                    "closedAt":
                        closed_at,

                    "closeDeal":
                        (
                            serialize_value(
                                close_deal
                            )
                            if close_deal
                            else None
                        ),

                    "result":
                        serialize_value(
                            result
                        )

                }), 200

        # ------------------------------------------------------
        # CLOSE FAILED
        # ------------------------------------------------------

        return jsonify({

            "success":
                False,

            "message":
                "Unable to close MT5 position.",

            "ticket":
                ticket,

            "result":
                serialize_value(
                    last_result
                )

        }), 500

    except Exception as error:

        print(
            "❌ MT5 CLOSE POSITION ERROR:",
            error
        )

        traceback.print_exc()

        return jsonify({

            "success":
                False,

            "message":
                "Failed to close MT5 position.",

            "error":
                str(error)

        }), 500


# ==========================================================
# MODIFY OPEN POSITION SL/TP
# POST /mt5/modify-position
# ==========================================================

@app.route(
    "/mt5/modify-position",
    methods=["POST"]
)
def modify_position():
    try:

        data = request.get_json(
            silent=True
        ) or {}

        ticket = (
            data.get("ticket")
            or data.get("positionId")
            or data.get("brokerPositionId")
            or data.get("id")
        )

        stop_loss = (
            data.get("stopLoss")
            if "stopLoss" in data
            else data.get("sl")
        )

        take_profit = (
            data.get("takeProfit")
            if "takeProfit" in data
            else data.get("tp")
        )

        # --------------------------------------------------
        # VALIDATE TICKET
        # --------------------------------------------------

        if ticket is None:
            return jsonify({
                "success": False,
                "message":
                    "Position ticket is required."
            }), 400

        try:
            ticket = int(ticket)
        except Exception:
            return jsonify({
                "success": False,
                "message":
                    "Invalid position ticket."
            }), 400

        if ticket <= 0:
            return jsonify({
                "success": False,
                "message":
                    "Invalid position ticket."
            }), 400

        # --------------------------------------------------
        # CONNECTION
        # --------------------------------------------------

        if not ensure_mt5_connection():
            return jsonify({
                "success": False,
                "message":
                    "MT5 is not connected.",
                "error":
                    mt5_error()
            }), 503

        # --------------------------------------------------
        # FIND POSITION
        # --------------------------------------------------

        positions = mt5.positions_get(
            ticket=ticket
        )

        if not positions:
            return jsonify({
                "success": False,
                "message":
                    "Position not found.",
                "ticket":
                    ticket
            }), 404

        position = positions[0]

        symbol = str(
            getattr(
                position,
                "symbol",
                ""
            ) or ""
        ).upper().strip()

        if not symbol:
            return jsonify({
                "success": False,
                "message":
                    "Position symbol is unavailable.",
                "ticket":
                    ticket
            }), 400

        # --------------------------------------------------
        # CURRENT SL / TP
        # --------------------------------------------------

        current_sl = float(
            getattr(
                position,
                "sl",
                0
            ) or 0
        )

        current_tp = float(
            getattr(
                position,
                "tp",
                0
            ) or 0
        )

        # --------------------------------------------------
        # NEW SL
        # --------------------------------------------------

        if stop_loss in (
            None,
            ""
        ):
            new_sl = current_sl

        elif stop_loss in (
            0,
            "0"
        ):
            new_sl = 0.0

        else:
            try:
                new_sl = float(
                    stop_loss
                )
            except Exception:
                return jsonify({
                    "success": False,
                    "message":
                        "Invalid Stop Loss."
                }), 400

            if new_sl <= 0:
                return jsonify({
                    "success": False,
                    "message":
                        "Invalid Stop Loss."
                }), 400

            new_sl = normalize_price(
                symbol,
                new_sl
            )

            if new_sl is None:
                return jsonify({
                    "success": False,
                    "message":
                        "Invalid Stop Loss."
                }), 400

        # --------------------------------------------------
        # NEW TP
        # --------------------------------------------------

        if take_profit in (
            None,
            ""
        ):
            new_tp = current_tp

        elif take_profit in (
            0,
            "0"
        ):
            new_tp = 0.0

        else:
            try:
                new_tp = float(
                    take_profit
                )
            except Exception:
                return jsonify({
                    "success": False,
                    "message":
                        "Invalid Take Profit."
                }), 400

            if new_tp <= 0:
                return jsonify({
                    "success": False,
                    "message":
                        "Invalid Take Profit."
                }), 400

            new_tp = normalize_price(
                symbol,
                new_tp
            )

            if new_tp is None:
                return jsonify({
                    "success": False,
                    "message":
                        "Invalid Take Profit."
                }), 400

        # --------------------------------------------------
        # REQUEST
        # --------------------------------------------------

        request_data = {
            "action":
                mt5.TRADE_ACTION_SLTP,

            "symbol":
                symbol,

            "position":
                ticket,

            "sl":
                new_sl,

            "tp":
                new_tp
        }

        print("")
        print("====================================")
        print("✏️ MT5 MODIFY OPEN POSITION")
        print("====================================")

        print(
            "Ticket:",
            ticket
        )

        print(
            "Symbol:",
            symbol
        )

        print(
            "Old SL:",
            current_sl
        )

        print(
            "New SL:",
            new_sl
        )

        print(
            "Old TP:",
            current_tp
        )

        print(
            "New TP:",
            new_tp
        )

        print(
            "REQUEST:",
            request_data
        )

        # --------------------------------------------------
        # SEND
        # --------------------------------------------------

        result = mt5.order_send(
            request_data
        )

        print(
            "MT5 SL/TP MODIFY RESULT:",
            serialize_value(result)
        )

        if result is None:
            return jsonify({
                "success": False,
                "message":
                    "MT5 modify position request returned no result.",
                "ticket":
                    ticket,
                "error":
                    mt5_error()
            }), 500

        retcode = getattr(
            result,
            "retcode",
            None
        )

        retcode_int = (
            int(retcode)
            if retcode is not None
            else None
        )

        # --------------------------------------------------
        # SUCCESS
        # --------------------------------------------------

        if retcode_int in (
            mt5.TRADE_RETCODE_DONE,
            mt5.TRADE_RETCODE_PLACED
        ):

            # Read position again from MT5
            updated_positions = (
                mt5.positions_get(
                    ticket=ticket
                )
            )

            updated_position = (
                updated_positions[0]
                if updated_positions
                else None
            )

            print("")
            print(
                "===================================="
            )

            print(
                "✅ MT5 OPEN POSITION SL/TP MODIFIED"
            )

            print(
                "Ticket:",
                ticket
            )

            print(
                "SL:",
                new_sl
            )

            print(
                "TP:",
                new_tp
            )

            print(
                "===================================="
            )

            return jsonify({

                "success":
                    True,

                "message":
                    "MT5 position SL/TP modified successfully.",

                "ticket":
                    ticket,

                "positionId":
                    ticket,

                "brokerPositionId":
                    ticket,

                "symbol":
                    symbol,

                "stopLoss":
                    new_sl,

                "takeProfit":
                    new_tp,

                "sl":
                    new_sl,

                "tp":
                    new_tp,

                "retcode":
                    retcode_int,

                "result":
                    serialize_value(
                        result
                    ),

                "position":
                    serialize_value(
                        updated_position
                    )
                    if updated_position
                    else None
            }), 200

        # --------------------------------------------------
        # FAILURE
        # --------------------------------------------------

        return jsonify({

            "success":
                False,

            "message":
                "MT5 rejected position SL/TP modification.",

            "ticket":
                ticket,

            "retcode":
                retcode_int,

            "result":
                serialize_value(
                    result
                ),

            "error":
                mt5_error()

        }), 400

    except Exception as error:

        print("")
        print(
            "❌ MT5 MODIFY POSITION ERROR:",
            error
        )

        traceback.print_exc()

        return jsonify({
            "success": False,
            "message":
                "Failed to modify MT5 position SL/TP.",
            "error":
                str(error)
        }), 500

# ==========================================================
# DISCONNECT
# ==========================================================

@app.route(
    "/mt5/disconnect",
    methods=["POST"]
)
def mt5_disconnect():

    global MT5_CONNECTED

    with MT5_CONNECTION_LOCK:

        try:

            if MT5_CONNECTED:
                _mt5_connection_mutation(
                    mt5.shutdown
                )

            MT5_CONNECTED = False

            print(
                "🔌 MT5 DISCONNECTED"
            )

            return jsonify({
                "success": True,
                "connected": False,
                "message":
                    "MT5 disconnected."
            })

        except Exception as error:

            MT5_CONNECTED = False

            return jsonify({
                "success": False,
                "connected": False,
                "message":
                    "MT5 disconnect error.",
                "error":
                    str(error)
            }), 500


# ==========================================================
# STARTUP
# ==========================================================

if __name__ == "__main__":

    initialize_mt5()

    print("")
    print("====================================")
    print("Available endpoints:")
    print("GET  /health")
    print("GET  /mt5/status")
    print("GET  /mt5/account")
    print("GET  /mt5/price")
    print("GET  /mt5/positions")
    print("GET  /mt5/orders")
    print("GET  /mt5/order/<ticket>")
    print("POST /mt5/order")
    print("POST /mt5/pending-order")
    print("POST /mt5/cancel-order")
    print("POST /mt5/modify-order")
    print("GET  /mt5/history")
    print("POST /mt5/close-position")
    print("POST /mt5/modify-position")
    print("POST /mt5/disconnect")
    print("====================================")

    app.run(
        host=BRIDGE_HOST,
        port=BRIDGE_PORT,
        debug=False,
        threaded=True
    )