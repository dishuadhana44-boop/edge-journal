import { useContext } from "react";
import { OrderContext } from "./OrderContext";

export default function useOrder() {
  return useContext(OrderContext);
}