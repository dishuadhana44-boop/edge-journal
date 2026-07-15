
function EditBasicTradeForm({
    form,
    setForm,
    onNext,
    onSave,
    onCancel,
  }) {
    return (
      <div className="bg-white rounded-2xl shadow-xl w-[500px] p-6">
  
  <h2 className="text-2xl font-bold">
  Edit Trade
</h2>

<div className="space-y-4">

{/* Pair */}
<input
  type="text"
  placeholder="e.g. XAUUSD"
  value={form.pair}
  onChange={(e) =>
    setForm({
      ...form,
      pair: e.target.value,
    })
  }
  className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500"
/>

{/* Date */}
<input
  type="date"
  value={form.date}
  onChange={(e) =>
    setForm({
      ...form,
      date: e.target.value,
    })
  }
  className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500"
/>

{/* Session */}
<select
  value={form.session}
  onChange={(e) =>
    setForm({
      ...form,
      session: e.target.value,
    })
  }
  className="w-full border rounded-xl px-4 py-3"
>
  <option value="">Select Session</option>
  <option>London</option>
  <option>New York</option>
  <option>Asia</option>
</select>

{/* Direction */}
<select
  value={form.direction}
  onChange={(e) =>
    setForm({
      ...form,
      direction: e.target.value,
    })
  }
  className="w-full border rounded-xl px-4 py-3"
>
  <option>Buy</option>
  <option>Sell</option>
</select>

{/* Result */}
<select
  value={form.result}
  onChange={(e) =>
    setForm({
      ...form,
      result: e.target.value,
    })
  }
  className="w-full border rounded-xl px-4 py-3"
>
  <option>Win</option>
  <option>Loss</option>
  <option>Break Even</option>
</select>

{/* Risk Reward */}
<input
  type="text"
  placeholder="Risk Reward (1:3)"
  value={form.rr}
  onChange={(e) =>
    setForm({
      ...form,
      rr: e.target.value,
    })
  }
  className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500"
/>

{/* Profit & Loss */}
<input
  type="text"
  placeholder="Profit & Loss"
  value={form.pnl}
  onChange={(e) =>
    setForm({
      ...form,
      pnl: e.target.value,
    })
  }
  className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500"
/>

</div>

<div className="flex justify-between items-center mt-8">

  {/* More Details */}
  <button
    type="button"
    onClick={onNext}
    className="text-purple-600 font-semibold hover:text-purple-700 transition"
  >
    More Details →
  </button>

  <div className="flex gap-3">

    {/* Cancel */}
    <button
      type="button"
      onClick={onCancel}
      className="px-5 py-2 rounded-xl border border-gray-300 hover:bg-gray-100"
    >
      Cancel
    </button>

    {/* Save */}
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
  
  export default EditBasicTradeForm;