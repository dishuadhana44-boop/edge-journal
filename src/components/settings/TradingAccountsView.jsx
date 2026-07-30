import {
    Wallet,
    CircleDollarSign,
    BadgeCheck,
    Landmark,
  } from "lucide-react";
  
  export default function TradingAccountsView({ account }) {
    return (
  
      <div className="grid grid-cols-2 gap-8">
  
        {/* Account Name */}
  
        <div className="flex items-start gap-4">
  
          <div
            className="
            w-14
            h-14
            rounded-2xl
            bg-violet-100
            flex
            items-center
            justify-center
            "
          >
            <Wallet
              size={26}
              className="text-violet-600"
            />
          </div>
  
          <div>
  
            <p className="text-sm text-gray-800">
              Account Name
            </p>
  
            <h2 className="text-xl font-bold mt-1">
              {account.accountName}
            </h2>
  
          </div>
  
        </div>
  
        {/* Account Type */}
  
        <div className="flex items-start gap-4">
  
          <div
            className="
            w-14
            h-14
            rounded-2xl
            bg-blue-100
            flex
            items-center
            justify-center
            "
          >
            <BadgeCheck
              size={26}
              className="text-blue-600"
            />
          </div>
  
          <div>
  
            <p className="text-sm text-gray-800">
              Account Type
            </p>
  
            <h2 className="text-xl font-bold mt-1">
              {account.accountType}
            </h2>
  
          </div>
  
        </div>
  
        {/* Currency */}
  
        <div className="flex items-start gap-4">
  
          <div
            className="
            w-14
            h-14
            rounded-2xl
            bg-green-100
            flex
            items-center
            justify-center
            "
          >
            <CircleDollarSign
              size={26}
              className="text-green-600"
            />
          </div>
  
          <div>
  
            <p className="text-sm text-gray-800">
              Currency
            </p>
  
            <h2 className="text-xl font-bold mt-1">
              {account.currency}
            </h2>
  
          </div>
  
        </div>
  
        {/* Starting Balance */}
  
        <div className="flex items-start gap-4">
  
          <div
            className="
            w-14
            h-14
            rounded-2xl
            bg-orange-100
            flex
            items-center
            justify-center
            "
          >
            <Landmark
              size={26}
              className="text-orange-600"
            />
          </div>
  
          <div>
  
            <p className="text-sm text-gray-800">
              Account Balance
            </p>
  
            <h2 className="text-xl font-bold mt-1">
              {account.currency}{" "}
              {Number(account.startingBalance).toLocaleString()}
            </h2>
  
          </div>
  
        </div>
  
      </div>
  
    );
  }