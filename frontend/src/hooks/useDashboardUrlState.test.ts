import { renderHook, act } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { useDashboardUrlState } from "./useDashboardUrlState";
import React from "react";

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(BrowserRouter, {}, children);

describe("useDashboardUrlState", () => {
  it("initializes with default values", () => {
    const { result } = renderHook(() => useDashboardUrlState(), { wrapper });

    expect(result.current.state.tab).toBe("deposit");
    expect(result.current.state.step).toBe("amount");
    expect(result.current.state.amount).toBe("");
  });

  it("updates tab in URL", () => {
    const { result } = renderHook(() => useDashboardUrlState(), { wrapper });

    act(() => {
      result.current.setTab("withdraw");
    });

    expect(result.current.state.tab).toBe("withdraw");
  });

  it("updates step in URL", () => {
    const { result } = renderHook(() => useDashboardUrlState(), { wrapper });

    act(() => {
      result.current.setStep("review");
    });

    expect(result.current.state.step).toBe("review");
  });

  it("updates amount in URL", () => {
    const { result } = renderHook(() => useDashboardUrlState(), { wrapper });

    act(() => {
      result.current.setAmount("100.50");
    });

    expect(result.current.state.amount).toBe("100.50");
  });

  it("updates multiple state values at once", () => {
    const { result } = renderHook(() => useDashboardUrlState(), { wrapper });

    act(() => {
      result.current.setState({
        tab: "withdraw",
        step: "review",
        amount: "50",
      });
    });

    expect(result.current.state.tab).toBe("withdraw");
    expect(result.current.state.step).toBe("review");
    expect(result.current.state.amount).toBe("50");
  });

  it("resets all state to defaults", () => {
    const { result } = renderHook(() => useDashboardUrlState(), { wrapper });

    act(() => {
      result.current.setState({
        tab: "withdraw",
        step: "result",
        amount: "999",
      });
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.tab).toBe("deposit");
    expect(result.current.state.step).toBe("amount");
    expect(result.current.state.amount).toBe("");
  });

  it("clears amount when set to empty string", () => {
    const { result } = renderHook(() => useDashboardUrlState(), { wrapper });

    act(() => {
      result.current.setAmount("100");
    });

    expect(result.current.state.amount).toBe("100");

    act(() => {
      result.current.setAmount("");
    });

    expect(result.current.state.amount).toBe("");
  });
});
