// range-bar.jsx -- the date-range bar under a report page's header. One
// pattern for every report: presets as a SegmentedControl from xl, the same
// choice as a labelled Select below that (six presets don't fit beside the
// open sidebar on a tablet), and From/To pickers when "custom" is chosen.
// Not a card -- it's a toolbar for the page, so it sits on the page surface.
// no-print: the header's date line carries the range into print.
//
//   <RangeBar idBase label value onChange options={[{ value, label }]}
//             custom={{ from, to, onFrom, onTo, fromLabel, toLabel }} />
//   (`custom` renders only while value === "custom")
import DatePicker from "../DatePicker.jsx";
import { cn } from "../../lib/cn.js";
import { Field, Select } from "./field.jsx";
import { SegmentedControl } from "./segmented-control.jsx";

export function RangeBar({ idBase, label, value, onChange, options, custom, className }) {
  return (
    <div className={cn("no-print mb-6 flex flex-col gap-4 xl:flex-row xl:items-end", className)}>
      <div className="hidden xl:block">
        <SegmentedControl label={label} value={value} onChange={onChange} options={options} />
      </div>
      <Field className="xl:hidden sm:max-w-xs" label={label} htmlFor={idBase + "-range"}>
        <Select id={idBase + "-range"} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>
      {value === "custom" && custom ? (
        <div className="grid grid-cols-1 gap-4 sm:max-w-xl sm:grid-cols-2 xl:flex-1">
          <Field label={custom.fromLabel} htmlFor={idBase + "-from"}>
            <div className="ds-control"><DatePicker id={idBase + "-from"} value={custom.from} onChange={custom.onFrom} /></div>
          </Field>
          <Field label={custom.toLabel} htmlFor={idBase + "-to"}>
            <div className="ds-control"><DatePicker id={idBase + "-to"} value={custom.to} onChange={custom.onTo} /></div>
          </Field>
        </div>
      ) : null}
    </div>
  );
}
