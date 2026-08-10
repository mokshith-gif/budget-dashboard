import { useEffect, useState } from "react";

export function fmtINR(n) {
  if (n === undefined || n === null || isNaN(n)) return "—";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export function fmtINRShort(n) {
  if (n === undefined || n === null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 10000000) return "₹" + (n / 10000000).toFixed(1) + " Cr";
  if (abs >= 100000) return "₹" + (n / 100000).toFixed(1) + " L";
  if (abs >= 1000) return "₹" + (n / 1000).toFixed(1) + " K";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export function fmtPct(n, digits = 1) {
  if (n === undefined || n === null || isNaN(n)) return "—";
  return n.toFixed(digits) + "%";
}

export function pctChange(cur, prev) {
  if (prev === undefined || prev === null || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

export function chartAxis(n) {
  if (n === undefined || n === null || isNaN(n)) return "—";
  return fmtINRShort(n).replace("₹", "");
}

export function useFetch(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((err) =>
        alive && setState({ data: null, loading: false, error: err.message || String(err) })
      );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}