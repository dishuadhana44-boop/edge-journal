export function getSetupAnalytics(trades = []) {

    const setups = {};
  
    trades.forEach((trade) => {
  
      const setup = trade.setup?.trim();
  
      if (!setup) return;
  
      if (!setups[setup]) {
  
        setups[setup] = {
  
          trades: 0,
  
          wins: 0,
  
          losses: 0,
  
          pnl: 0,
  
          rr: 0,
  
        };
  
      }
  
      setups[setup].trades++;
  
      setups[setup].pnl += Number(trade.pnl || 0);
  
      setups[setup].rr += Number(trade.rr || 0);
  
      if (trade.result === "Win") {
  
        setups[setup].wins++;
  
      } else {
  
        setups[setup].losses++;
  
      }
  
    });
  
    return Object.entries(setups).map(([name, data]) => ({
  
      name,
  
      trades: data.trades,
  
      wins: data.wins,
  
      losses: data.losses,
  
      winRate: Math.round((data.wins / data.trades) * 100),
  
      avgRR: (data.rr / data.trades).toFixed(2),
  
      pnl: data.pnl,
  
    }));
  
  }