import {
    MoreVertical,
    Pencil,
    ShieldAlert,
    Target,
    XCircle,
    Check,
  } from "lucide-react";
  
  import {
    useEffect,
    useRef,
    useState,
  } from "react";
  
  export default function PendingOrderRow({
    order,
    demo = false,
    onCancel,
    onModifyEntry,
    onModifyStopLoss,
    onModifyTakeProfit,
  }) {
    const [menuOpen, setMenuOpen] =
      useState(false);
  
    const [editMode, setEditMode] =
      useState(null);
  
    const [editValue, setEditValue] =
      useState("");
  
    const menuRef =
      useRef(null);
  
    // ==========================================================
    // CLOSE MENU WHEN CLICKING OUTSIDE
    // ==========================================================
  
    useEffect(() => {
      const handleOutsideClick = (
        event
      ) => {
        if (
          menuRef.current &&
          !menuRef.current.contains(
            event.target
          )
        ) {
          setMenuOpen(false);
        }
      };
  
      document.addEventListener(
        "mousedown",
        handleOutsideClick
      );
  
      return () => {
        document.removeEventListener(
          "mousedown",
          handleOutsideClick
        );
      };
    }, []);
  
    // ==========================================================
    // NORMALIZE VALUES
    // ==========================================================
  
    const symbol =
      String(
        order?.symbol ||
          order?.instrument ||
          "EURUSD"
      ).toUpperCase();
  
    const type =
      String(
        order?.orderType ||
          order?.type ||
          "Limit"
      );
  
    const quantity =
      Number(
        order?.quantity ??
          order?.lots ??
          order?.volume ??
          0
      );
  
    const entry =
      Number(
        order?.entry ??
          order?.entryPrice ??
          order?.price ??
          0
      );
  
    const currentPrice =
      Number(
        order?.currentPrice ??
          order?.markPrice ??
          0
      );
  
    const takeProfit =
      Number(
        order?.takeProfit ??
          order?.tp ??
          0
      );
  
    const stopLoss =
      Number(
        order?.stopLoss ??
          order?.sl ??
          0
      );
  
    const margin =
      Number(
        order?.margin ??
          order?.usedMargin ??
          0
      );
  
    const orderId =
      order?.orderId ??
      order?.brokerOrderId ??
      order?.ticket ??
      order?.id;
  
    // ==========================================================
    // FORMAT PRICE
    // ==========================================================
  
    const formatPrice = (
      value
    ) => {
      const number =
        Number(value);
  
      if (
        !Number.isFinite(number) ||
        number <= 0
      ) {
        return "—";
      }
  
      if (number >= 100) {
        return number.toFixed(3);
      }
  
      return number.toFixed(5);
    };
  
    // ==========================================================
    // FORMAT MONEY
    // ==========================================================
  
    const formatMoney = (
      value
    ) => {
      const number =
        Number(value);
  
      if (
        !Number.isFinite(number)
      ) {
        return "—";
      }
  
      return number.toFixed(2);
    };
  
    // ==========================================================
    // TYPE COLOR
    // ==========================================================
  
    const normalizedType =
      type.toLowerCase();
  
    const isBuy =
      normalizedType.includes(
        "buy"
      );
  
    const isSell =
      normalizedType.includes(
        "sell"
      );
  
    const typeClass =
      isBuy
        ? "text-green-600 bg-green-50"
        : isSell
        ? "text-red-600 bg-red-50"
        : "text-blue-600 bg-blue-50";
  
    // ==========================================================
    // START EDIT
    // ==========================================================
  
    const startEdit = (
      field
    ) => {
      let value = "";
  
      if (
        field === "entry"
      ) {
        value =
          entry > 0
            ? String(entry)
            : "";
      }
  
      if (
        field === "stopLoss"
      ) {
        value =
          stopLoss > 0
            ? String(stopLoss)
            : "";
      }
  
      if (
        field === "takeProfit"
      ) {
        value =
          takeProfit > 0
            ? String(takeProfit)
            : "";
      }
  
      setEditValue(value);
      setEditMode(field);
      setMenuOpen(false);
    };
  
    // ==========================================================
    // CANCEL EDIT
    // ==========================================================
  
    const cancelEdit = () => {
      setEditMode(null);
      setEditValue("");
    };
  
    // ==========================================================
    // SAVE EDIT
    // ==========================================================
  
    const saveEdit = () => {
      const value =
        Number(editValue);
  
      if (
        !Number.isFinite(value) ||
        value <= 0
      ) {
        return;
      }
  
      // --------------------------------------------------------
      // ENTRY
      // --------------------------------------------------------
  
      if (
        editMode === "entry"
      ) {
        if (
          typeof onModifyEntry ===
          "function"
        ) {
          onModifyEntry(
            order,
            value
          );
        }
      }
  
      // --------------------------------------------------------
      // STOP LOSS
      // --------------------------------------------------------
  
      if (
        editMode ===
        "stopLoss"
      ) {
        if (
          typeof onModifyStopLoss ===
          "function"
        ) {
          onModifyStopLoss(
            order,
            value
          );
        }
      }
  
      // --------------------------------------------------------
      // TAKE PROFIT
      // --------------------------------------------------------
  
      if (
        editMode ===
        "takeProfit"
      ) {
        if (
          typeof onModifyTakeProfit ===
          "function"
        ) {
          onModifyTakeProfit(
            order,
            value
          );
        }
      }
  
      setEditMode(null);
      setEditValue("");
    };
  
    // ==========================================================
    // CANCEL PENDING ORDER
    // ==========================================================
  
    const handleCancelOrder =
      () => {
        setMenuOpen(false);
  
        if (
          typeof onCancel ===
          "function"
        ) {
          onCancel(order);
          return;
        }
  
        console.log(
          "🟠 PENDING ORDER CANCEL:",
          order
        );
      };
  
    // ==========================================================
    // EDIT CELL
    // ==========================================================
  
    const renderEditableCell = (
      field,
      value,
      align = "right"
    ) => {
      if (
        editMode !== field
      ) {
        return (
          <td
            className={`w-[110px] py-4 ${
              align === "right"
                ? "text-right"
                : "text-center"
            } text-sm text-gray-700`}
          >
            {formatPrice(value)}
          </td>
        );
      }
  
      return (
        <td className="w-[110px] py-2 text-right">
          <div className="flex items-center justify-end gap-1">
            <input
              autoFocus
              type="number"
              step="0.00001"
              value={editValue}
              onChange={(event) =>
                setEditValue(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  saveEdit();
                }
  
                if (
                  event.key ===
                  "Escape"
                ) {
                  cancelEdit();
                }
              }}
              className="w-[82px] px-2 py-1.5 text-right text-sm border border-gray-300 rounded-md outline-none focus:border-gray-500"
            />
  
            <button
              type="button"
              onClick={
                saveEdit
              }
              className="p-1.5 rounded-md text-green-600 hover:bg-green-50"
              title="Save"
            >
              <Check
                size={15}
              />
            </button>
          </div>
        </td>
      );
    };
  
    // ==========================================================
    // RENDER
    // ==========================================================
  
    return (
      <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
        {/* ====================================================
            INSTRUMENT
            ==================================================== */}
  
        <td className="w-[110px] px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-semibold text-gray-600">
              {symbol.slice(
                0,
                2
              )}
            </div>
  
            <div className="font-medium text-gray-900">
              {symbol}
            </div>
          </div>
        </td>
  
        {/* ====================================================
            TYPE
            ==================================================== */}
  
        <td className="w-[80px] py-4 text-center">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${typeClass}`}
          >
            {type}
          </span>
        </td>
  
        {/* ====================================================
            LOTS
            ==================================================== */}
  
        <td className="w-[80px] py-4 text-center text-sm text-gray-700">
          {Number.isFinite(
            quantity
          )
            ? quantity.toFixed(2)
            : "0.00"}
        </td>
  
        {/* ====================================================
            ENTRY
            ==================================================== */}
  
        {renderEditableCell(
          "entry",
          entry
        )}
  
        {/* ====================================================
            CURRENT
            ==================================================== */}
  
        <td className="w-[100px] py-4 text-right text-sm text-gray-700">
          {formatPrice(
            currentPrice
          )}
        </td>
  
        {/* ====================================================
            TAKE PROFIT
            ==================================================== */}
  
        {renderEditableCell(
          "takeProfit",
          takeProfit
        )}
  
        {/* ====================================================
            STOP LOSS
            ==================================================== */}
  
        {renderEditableCell(
          "stopLoss",
          stopLoss
        )}
  
        {/* ====================================================
            MARGIN
            ==================================================== */}
  
        <td className="w-[110px] py-4 text-right text-sm text-gray-700">
          {margin > 0
            ? `$${formatMoney(
                margin
              )}`
            : "—"}
        </td>
  
        {/* ====================================================
            DURATION
            ==================================================== */}
  
        <td className="w-[110px] py-4 text-right text-sm text-gray-500">
          {order?.duration ||
            "—"}
        </td>
  
        {/* ====================================================
            ACTIONS
            ==================================================== */}
  
        <td className="w-[100px] py-4 text-center">
          <div
            className="relative inline-block"
            ref={menuRef}
          >
            <button
              type="button"
              onClick={() =>
                setMenuOpen(
                  (prev) =>
                    !prev
                )
              }
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Order actions"
            >
              <MoreVertical
                size={18}
              />
            </button>
  
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-[210px] rounded-xl border border-gray-200 bg-white shadow-lg py-1 text-left">
                {/* ------------------------------------------
                    MODIFY ENTRY
                    ------------------------------------------ */}
  
                <button
                  type="button"
                  onClick={() =>
                    startEdit(
                      "entry"
                    )
                  }
                  className="w-full px-3 py-2.5 flex items-center gap-3 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Pencil
                    size={16}
                  />
  
                  <span>
                    Modify Entry
                  </span>
                </button>
  
                {/* ------------------------------------------
                    MODIFY SL
                    ------------------------------------------ */}
  
                <button
                  type="button"
                  onClick={() =>
                    startEdit(
                      "stopLoss"
                    )
                  }
                  className="w-full px-3 py-2.5 flex items-center gap-3 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <ShieldAlert
                    size={16}
                  />
  
                  <span>
                    Modify Stop Loss
                  </span>
                </button>
  
                {/* ------------------------------------------
                    MODIFY TP
                    ------------------------------------------ */}
  
                <button
                  type="button"
                  onClick={() =>
                    startEdit(
                      "takeProfit"
                    )
                  }
                  className="w-full px-3 py-2.5 flex items-center gap-3 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Target
                    size={16}
                  />
  
                  <span>
                    Modify Take Profit
                  </span>
                </button>
  
                <div className="my-1 border-t border-gray-100" />
  
                {/* ------------------------------------------
                    CANCEL
                    ------------------------------------------ */}
  
                <button
                  type="button"
                  onClick={
                    handleCancelOrder
                  }
                  className="w-full px-3 py-2.5 flex items-center gap-3 text-sm text-red-600 hover:bg-red-50"
                >
                  <XCircle
                    size={16}
                  />
  
                  <span>
                    Cancel Pending Order
                  </span>
                </button>
              </div>
            )}
          </div>
        </td>
      </tr>
    );
  }