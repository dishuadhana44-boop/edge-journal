from flask import Flask, jsonify, request
from flask_cors import CORS

import MetaTrader5 as mt5

from datetime import datetime, timedelta, timezone

import traceback
import math
import time


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

        initialized = mt5.initialize()

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
# CONNECTION CHECK
# ==========================================================

def ensure_mt5_connection():
    global MT5_CONNECTED

    try:
        terminal = mt5.terminal_info()
        account = mt5.account_info()

        if terminal is None or account is None:
            MT5_CONNECTED = False

            initialized = mt5.initialize()

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


def normalize_open_volume(symbol, volume):
    """
    Normalize volume for new market/pending orders.
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

        # Clamp to broker limits.
        volume = max(
            volume_min,
            min(
                volume,
                volume_max
            )
        )

        if volume_step > 0:
            steps = round(
                (
                    volume -
                    volume_min
                ) / volume_step
            )

            volume = (
                volume_min +
                steps * volume_step
            )

        if volume < volume_min:
            volume = volume_min

        if volume > volume_max:
            volume = volume_max

        return round(
            volume,
            8
        )

    except Exception as error:
        print(
            "⚠️ OPEN VOLUME NORMALIZATION ERROR:",
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

def get_broker_time_msc(positions=None):
    """
    Get MT5 broker/server time in milliseconds.
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

            tick = mt5.symbol_info_tick(
                symbol
            )

            if tick is None:
                continue

            tick_time_msc = getattr(
                tick,
                "time_msc",
                None
            )

            if tick_time_msc:
                print(
                    "🕒 MT5 BROKER CLOCK:",
                    {
                        "symbol": symbol,
                        "source": "tick.time_msc",
                        "broker_time_msc":
                            int(tick_time_msc)
                    }
                )

                return int(
                    tick_time_msc
                )

            tick_time = getattr(
                tick,
                "time",
                None
            )

            if tick_time:
                return int(
                    tick_time
                ) * 1000

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

            tick = mt5.symbol_info_tick(
                symbol
            )

            if tick is None:
                continue

            tick_time_msc = getattr(
                tick,
                "time_msc",
                None
            )

            if tick_time_msc:
                return int(
                    tick_time_msc
                )

            tick_time = getattr(
                tick,
                "time",
                None
            )

            if tick_time:
                return int(
                    tick_time
                ) * 1000

    except Exception as error:
        print(
            "⚠️ BROKER CLOCK ERROR:",
            error
        )

    return int(
        time.time() * 1000
    )


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

        broker_time_msc = (
            get_broker_time_msc(
                positions
            )
        )

        print(
            "🕒 MT5 POSITIONS BROKER CLOCK"
        )

        print(
            "broker_time_msc:",
            broker_time_msc
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
            "count":
                len(result),
            "positions":
                result,
            "broker_time_msc":
                broker_time_msc
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
        # --------------------------------------------------

        normalized_volume = (
            normalize_open_volume(
                symbol,
                lots
            )
        )

        if normalized_volume is None:
            return jsonify({
                "success": False,
                "message":
                    "Unable to normalize volume."
            }), 400

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
        # --------------------------------------------------

        volume = normalize_open_volume(
            symbol,
            lots
        )

        if volume is None:
            return jsonify({
                "success": False,
                "message":
                    "Unable to normalize volume."
            }), 400

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
# GET /mt5/history?days=30
# ==========================================================

@app.route(
    "/mt5/history",
    methods=["GET"]
)
def mt5_history():

    try:

        if not ensure_mt5_connection():
            return jsonify({
                "success": False,
                "history": [],
                "message":
                    "MT5 is not connected."
            }), 503

        days = int(
            request.args.get(
                "days",
                30
            )
        )

        if days <= 0:
            days = 30

        if days > 3650:
            days = 3650

        date_to = datetime.now()

        date_from = (
            date_to -
            timedelta(days=days)
        )

        deals = mt5.history_deals_get(
            date_from,
            date_to
        )

        if deals is None:
            deals = []

        history = []

        for deal in deals:

            try:

                raw = serialize_value(
                    deal
                )

                deal_data = {
                    "ticket":
                        int(
                            getattr(
                                deal,
                                "ticket",
                                0
                            ) or 0
                        ),

                    "order":
                        int(
                            getattr(
                                deal,
                                "order",
                                0
                            ) or 0
                        ),

                    "position_id":
                        int(
                            getattr(
                                deal,
                                "position_id",
                                0
                            ) or 0
                        ),

                    "symbol":
                        str(
                            getattr(
                                deal,
                                "symbol",
                                ""
                            ) or ""
                        ).upper(),

                    "type":
                        int(
                            getattr(
                                deal,
                                "type",
                                0
                            ) or 0
                        ),

                    "entry":
                        int(
                            getattr(
                                deal,
                                "entry",
                                0
                            ) or 0
                        ),

                    "volume":
                        float(
                            getattr(
                                deal,
                                "volume",
                                0
                            ) or 0
                        ),

                    "price":
                        float(
                            getattr(
                                deal,
                                "price",
                                0
                            ) or 0
                        ),

                    "profit":
                        float(
                            getattr(
                                deal,
                                "profit",
                                0
                            ) or 0
                        ),

                    "commission":
                        float(
                            getattr(
                                deal,
                                "commission",
                                0
                            ) or 0
                        ),

                    "swap":
                        float(
                            getattr(
                                deal,
                                "swap",
                                0
                            ) or 0
                        ),

                    "fee":
                        float(
                            getattr(
                                deal,
                                "fee",
                                0
                            ) or 0
                        ),

                    "time":
                        getattr(
                            deal,
                            "time",
                            None
                        ),

                    "time_msc":
                        getattr(
                            deal,
                            "time_msc",
                            None
                        ),

                    "comment":
                        str(
                            getattr(
                                deal,
                                "comment",
                                ""
                            ) or ""
                        ),

                    "magic":
                        int(
                            getattr(
                                deal,
                                "magic",
                                0
                            ) or 0
                        ),

                    "raw":
                        raw
                }

                history.append(
                    deal_data
                )

            except Exception as error:
                print(
                    "⚠️ HISTORY ITEM ERROR:",
                    error
                )

        return jsonify({
            "success": True,
            "count":
                len(history),
            "days":
                days,
            "history":
                history
        })

    except Exception as error:

        print(
            "❌ MT5 HISTORY ERROR:",
            error
        )

        traceback.print_exc()

        return jsonify({
            "success": False,
            "history": [],
            "message":
                "Failed to fetch MT5 history.",
            "error":
                str(error)
        }), 500


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

    try:

        if MT5_CONNECTED:
            mt5.shutdown()

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