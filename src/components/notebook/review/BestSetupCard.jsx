import useWeeklyReview from "../../../hooks/useWeeklyReview";
import { Target, Trophy } from "lucide-react";

export default function BestSetupCard() {

    const review = useWeeklyReview();

    if (!review.bestSetup) {

        return (

            <div className="bg-white rounded-3xl border border-gray-200 p-8">

                <h2 className="text-2xl font-bold">

                    Best Performing Setup

                </h2>

                <p className="text-gray-500 mt-6">

                    No setup data available.

                </p>

            </div>

        );

    }

    const setup = review.bestSetup;

    return (

        <div className="rounded-3xl overflow-hidden border border-purple-200 bg-gradient-to-br from-purple-50 to-white hover:shadow-[0_20px_50px_rgba(124,58,237,.18)] transition-all duration-500">

            <div className="p-8">

                <div className="flex items-center justify-between">

                    <div>

                        <p className="text-purple-600 font-semibold uppercase tracking-wider">

                            Best Performing Setup

                        </p>

                        <h2 className="text-3xl font-bold mt-3">

                            {setup.name}

                        </h2>

                    </div>

                    <div className="w-16 h-16 rounded-2xl bg-purple-600 flex items-center justify-center">

                        <Trophy className="text-white"/>

                    </div>

                </div>

                <div className="grid grid-cols-2 gap-5 mt-10">

                    <Metric
                        label="Win Rate"
                        value={`${setup.winRate}%`}
                    />

                    <Metric
                        label="Trades"
                        value={setup.trades}
                    />

                    <Metric
                        label="Average RR"
                        value={`${setup.avgRR}R`}
                    />

                    <Metric
                        label="Net P&L"
                        value={`£${setup.pnl}`}
                    />

                </div>

            </div>

        </div>

    );

}

function Metric({

    label,

    value,

}){

    return(

        <div className="rounded-2xl bg-white border border-gray-100 p-5">

            <p className="text-gray-400 text-sm">

                {label}

            </p>

            <h3 className="text-3xl font-bold mt-2">

                {value}

            </h3>

        </div>

    )

}