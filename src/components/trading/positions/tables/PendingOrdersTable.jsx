import PendingOrderRow from "../rows/PendingOrderRow";
import { useTrade } from "../../../../context/TradeContext";

export default function PendingOrdersTable({
  demo = false,
}) {
  const {
    pendingOrders = [],
    cancelPendingOrder,
    modifyPendingOrderEntry,
    modifyPendingOrderStopLoss,
    modifyPendingOrderTakeProfit,
  } = useTrade();

  // ==========================================================
  // CANCEL PENDING ORDER
  // ==========================================================

  const handleCancel = (order) => {
    if (!order) return;

    console.log(
      "❌ CANCEL PENDING ORDER:",
      order
    );

    if (
      typeof cancelPendingOrder ===
      "function"
    ) {
      cancelPendingOrder(order);
    } else {
      console.warn(
        "⚠️ cancelPendingOrder is not available in TradeContext"
      );
    }
  };

  // ==========================================================
  // MODIFY ENTRY
  // ==========================================================

  const handleModifyEntry = (
    order,
    value
  ) => {
    if (!order) return;

    const newEntry =
      Number(value);

    if (
      !Number.isFinite(
        newEntry
      ) ||
      newEntry <= 0
    ) {
      console.warn(
        "⚠️ Invalid pending order entry:",
        value
      );
      return;
    }

    console.log(
      "✏️ MODIFY PENDING ENTRY:",
      {
        order,
        newEntry,
      }
    );

    if (
      typeof modifyPendingOrderEntry ===
      "function"
    ) {
      modifyPendingOrderEntry(
        order,
        newEntry
      );
    } else {
      console.warn(
        "⚠️ modifyPendingOrderEntry is not available in TradeContext"
      );
    }
  };

  // ==========================================================
  // MODIFY STOP LOSS
  // ==========================================================

  const handleModifyStopLoss = (
    order,
    value
  ) => {
    if (!order) return;

    const newStopLoss =
      Number(value);

    if (
      !Number.isFinite(
        newStopLoss
      ) ||
      newStopLoss <= 0
    ) {
      console.warn(
        "⚠️ Invalid pending order stop loss:",
        value
      );
      return;
    }

    console.log(
      "🛡️ MODIFY PENDING STOP LOSS:",
      {
        order,
        newStopLoss,
      }
    );

    if (
      typeof modifyPendingOrderStopLoss ===
      "function"
    ) {
      modifyPendingOrderStopLoss(
        order,
        newStopLoss
      );
    } else {
      console.warn(
        "⚠️ modifyPendingOrderStopLoss is not available in TradeContext"
      );
    }
  };

  // ==========================================================
  // MODIFY TAKE PROFIT
  // ==========================================================

  const handleModifyTakeProfit = (
    order,
    value
  ) => {
    if (!order) return;

    const newTakeProfit =
      Number(value);

    if (
      !Number.isFinite(
        newTakeProfit
      ) ||
      newTakeProfit <= 0
    ) {
      console.warn(
        "⚠️ Invalid pending order take profit:",
        value
      );
      return;
    }

    console.log(
      "🎯 MODIFY PENDING TAKE PROFIT:",
      {
        order,
        newTakeProfit,
      }
    );

    if (
      typeof modifyPendingOrderTakeProfit ===
      "function"
    ) {
      modifyPendingOrderTakeProfit(
        order,
        newTakeProfit
      );
    } else {
      console.warn(
        "⚠️ modifyPendingOrderTakeProfit is not available in TradeContext"
      );
    }
  };

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="h-[340px] overflow-y-auto overflow-x-hidden">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="w-[110px] px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Instrument
            </th>

            <th className="w-[80px] py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Type
            </th>

            <th className="w-[80px] py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Lots
            </th>

            <th className="w-[100px] py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Entry
            </th>

            <th className="w-[100px] py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Current
            </th>

            <th className="w-[110px] py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Take Profit
            </th>

            <th className="w-[100px] py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Stop Loss
            </th>

            <th className="w-[110px] py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Margin
            </th>

            <th className="w-[110px] py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Duration
            </th>

            <th className="w-[100px] py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>

        <tbody className="bg-white">
          {pendingOrders.length > 0 ? (
            pendingOrders.map(
              (order, index) => (
                <PendingOrderRow
                  key={
                    order.orderId ??
                    order.brokerOrderId ??
                    order.ticket ??
                    order.id ??
                    index
                  }
                  order={order}
                  demo={demo}
                  onCancel={
                    handleCancel
                  }
                  onModifyEntry={
                    handleModifyEntry
                  }
                  onModifyStopLoss={
                    handleModifyStopLoss
                  }
                  onModifyTakeProfit={
                    handleModifyTakeProfit
                  }
                />
              )
            )
          ) : (
            <tr>
              <td
                colSpan={10}
                className="py-12 text-center text-gray-500"
              >
                No pending orders
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}