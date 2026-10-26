import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { useModalA11y } from "./useModalA11y.js";

function Dialog({ title, onClose, children }) {
  const boxRef = useModalA11y(onClose);
  return (
    <div ref={boxRef} role="dialog" aria-modal="true">
      <h2>{title}</h2>
      <button type="button">First {title}</button>
      {children}
      <button type="button">Last {title}</button>
    </div>
  );
}

function Harness({ nested }) {
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState(nested);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      {open && (
        <Dialog title="Outer" onClose={() => setOpen(false)}>
          {inner && <Dialog title="Inner" onClose={() => setInner(false)} />}
        </Dialog>
      )}
    </>
  );
}

describe("useModalA11y", () => {
  it("focuses the dialog, labels it by its heading, and closes on Escape back to the opener", () => {
    render(<Harness />);
    const opener = screen.getByText("Open");
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Outer");
    expect(document.activeElement).toBe(screen.getByText("First Outer"));

    fireEvent.keyDown(document.activeElement, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("wraps Tab and Shift+Tab inside the dialog", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Open"));
    const first = screen.getByText("First Outer");
    const last = screen.getByText("Last Outer");

    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("only lets the top-most of stacked dialogs react to Escape", () => {
    render(<Harness nested />);
    fireEvent.click(screen.getByText("Open"));
    expect(screen.getAllByRole("dialog")).toHaveLength(2);

    fireEvent.keyDown(document.activeElement, { key: "Escape" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Outer");

    fireEvent.keyDown(document.activeElement, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("leaves Escape to an open popup inside the dialog", () => {
    const onClose = vi.fn();
    function WithPopup() {
      const boxRef = useModalA11y(onClose);
      return (
        <div ref={boxRef} role="dialog" aria-modal="true">
          <button type="button" aria-expanded="true">Pick a date</button>
        </div>
      );
    }
    render(<WithPopup />);
    fireEvent.keyDown(screen.getByText("Pick a date"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
