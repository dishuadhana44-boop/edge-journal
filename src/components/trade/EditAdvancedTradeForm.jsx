function EditAdvancedTradeForm({
    form,
    setForm,
    onBack,
    onSave,
    onCancel,
  }) {
    return (
      <div className="bg-white rounded-2xl shadow-xl w-[700px] max-h-[90vh] overflow-y-auto p-6">
  
        {/* Header */}
        <div className="mb-8">

<button
  type="button"
  onClick={onBack}
  className="text-purple-600 font-semibold hover:text-purple-700 transition"
>
  ← Back
</button>

<h2 className="text-2xl font-bold mt-4">
  Advanced Trade Details
</h2>

<p className="text-gray-500 mt-1">
  Complete your trade journal with additional information.
</p>

</div>
        {/* Execution */}
        <div className="mb-10">

<h3 className="text-lg font-semibold text-gray-900 mb-5">
  Execution
</h3>

<div className="grid grid-cols-2 gap-5">

  {/* Entry Time */}
  <div>
    <label className="block text-sm font-medium mb-2">
      Entry Time
    </label>

    <input
      type="time"
      value={form.entryTime}
      onChange={(e) =>
        setForm({
          ...form,
          entryTime: e.target.value,
        })
      }
      className="w-full border rounded-xl px-4 py-3"
    />
  </div>

  {/* Exit Time */}
  <div>
    <label className="block text-sm font-medium mb-2">
      Exit Time
    </label>

    <input
      type="time"
      value={form.exitTime}
      onChange={(e) =>
        setForm({
          ...form,
          exitTime: e.target.value,
        })
      }
      className="w-full border rounded-xl px-4 py-3"
    />
  </div>

  {/* Duration */}
  <div>
    <label className="block text-sm font-medium mb-2">
      Duration
    </label>

    <input
      type="text"
      placeholder="30m"
      value={form.duration}
      onChange={(e) =>
        setForm({
          ...form,
          duration: e.target.value,
        })
      }
      className="w-full border rounded-xl px-4 py-3"
    />
  </div>

  {/* Entry Price */}
  <div>
    <label className="block text-sm font-medium mb-2">
      Entry Price
    </label>

    <input
      type="number"
      placeholder="1.08452"
      value={form.entryPrice}
      onChange={(e) =>
        setForm({
          ...form,
          entryPrice: e.target.value,
        })
      }
      className="w-full border rounded-xl px-4 py-3"
    />
  </div>

  {/* Stop Loss */}
  <div>
    <label className="block text-sm font-medium mb-2">
      Stop Loss
    </label>

    <input
      type="number"
      placeholder="1.08200"
      value={form.stopLoss}
      onChange={(e) =>
        setForm({
          ...form,
          stopLoss: e.target.value,
        })
      }
      className="w-full border rounded-xl px-4 py-3"
    />
  </div>

  {/* Take Profit */}
  <div>
    <label className="block text-sm font-medium mb-2">
      Take Profit
    </label>

    <input
      type="number"
      placeholder="1.08950"
      value={form.takeProfit}
      onChange={(e) =>
        setForm({
          ...form,
          takeProfit: e.target.value,
        })
      }
      className="w-full border rounded-xl px-4 py-3"
    />
  </div>

</div>

</div>
        {/* Position */}
        <div className="mb-10">

<h3 className="text-lg font-semibold text-gray-900 mb-5">
  Position
</h3>

<div className="grid grid-cols-2 gap-5">

  {/* Lot Size */}
  <div>
    <label className="block text-sm font-medium mb-2">
      Lot Size
    </label>

    <input
      type="number"
      placeholder="0.10"
      value={form.lotSize}
      onChange={(e) =>
        setForm({
          ...form,
          lotSize: e.target.value,
        })
      }
      className="w-full border rounded-xl px-4 py-3"
    />
  </div>

  {/* Account */}
  <div>
    <label className="block text-sm font-medium mb-2">
      Account
    </label>

    <input
      type="text"
      placeholder="FTMO Challenge"
      value={form.account}
      onChange={(e) =>
        setForm({
          ...form,
          account: e.target.value,
        })
      }
      className="w-full border rounded-xl px-4 py-3"
    />
  </div>

  {/* Broker */}
  <div>
    <label className="block text-sm font-medium mb-2">
      Broker
    </label>

    <input
      type="text"
      placeholder="IC Markets"
      value={form.broker}
      onChange={(e) =>
        setForm({
          ...form,
          broker: e.target.value,
        })
      }
      className="w-full border rounded-xl px-4 py-3"
    />
  </div>

</div>

</div>
        {/* Performance */}
        <div className="mb-10">

<h3 className="text-lg font-semibold text-gray-900 mb-5">
  Performance
</h3>

<div className="grid grid-cols-2 gap-5">

  {/* Risk (R) */}
  <div>
    <label className="block text-sm font-medium mb-2">
      Risk (R)
    </label>

    <input
      type="text"
      placeholder="1R"
      value={form.riskR}
      onChange={(e) =>
        setForm({
          ...form,
          riskR: e.target.value,
        })
      }
      className="w-full border rounded-xl px-4 py-3"
    />
  </div>

  {/* Return (R) */}
  <div>
    <label className="block text-sm font-medium mb-2">
      Return (R)
    </label>

    <input
      type="text"
      placeholder="3R"
      value={form.returnR}
      onChange={(e) =>
        setForm({
          ...form,
          returnR: e.target.value,
        })
      }
      className="w-full border rounded-xl px-4 py-3"
    />
  </div>

</div>

</div>
        {/* Extra */}
        <div className="mb-10">

<h3 className="text-lg font-semibold text-gray-900 mb-5">
  Extra Information
</h3>

<div className="grid grid-cols-2 gap-5">

  {/* Trade Type */}
  <div>
    <label className="block text-sm font-medium mb-2">
      Trade Type
    </label>

    <select
      value={form.tradeType}
      onChange={(e) =>
        setForm({
          ...form,
          tradeType: e.target.value,
        })
      }
      className="w-full border rounded-xl px-4 py-3"
    >
      <option value="">Select</option>
      <option>Scalp</option>
      <option>Intraday</option>
      <option>Swing</option>
      <option>Position</option>
    </select>
  </div>

  {/* Timeframe */}
  <div>
    <label className="block text-sm font-medium mb-2">
      Timeframe
    </label>

    <select
      value={form.timeframe}
      onChange={(e) =>
        setForm({
          ...form,
          timeframe: e.target.value,
        })
      }
      className="w-full border rounded-xl px-4 py-3"
    >
      <option value="">Select</option>
      <option>M1</option>
      <option>M5</option>
      <option>M15</option>
     <option>H1</option>
      <option>H4</option>
      <option>D1</option>
    </select>
  </div>

  {/* Setup */}
 

</div>

</div>
        {/* Bottom Buttons */}
        <div className="flex justify-end items-center gap-3 pt-6 ">



<div className="flex gap-3">

  <button
    type="button"
    onClick={onCancel}
    className="px-5 py-2 rounded-xl border hover:bg-gray-100 transition"
  >
    Cancel
  </button>

  <button
  type="button"
  onClick={onSave}
  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-medium transition"
>
  Update Trade
</button>
</div>

</div>
      </div>
    );
  }
  
  export default EditAdvancedTradeForm;