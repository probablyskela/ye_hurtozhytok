import { useEffect, useRef, useState, type ReactNode } from "react";

import { Icon } from "~/components/ui";
import {
  WEEKDAYS_SHORT,
  addDays,
  dateLong,
  dayOfMonth,
  weekdayIndex,
} from "~/lib/time";

/*
 * Our own controls instead of the browser's. Each keeps a real <input> inside
 * (visually hidden, still focusable), so forms post without JavaScript and
 * screen readers announce them as usual.
 */

/** A checkbox drawn in the app's style. */
export function Check({
  name,
  value,
  defaultChecked,
  checked,
  onChange,
  disabled,
  title,
  hint,
}: {
  name: string;
  value?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  title: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className={`check${disabled ? " is-disabled" : ""}`}>
      <input
        className="control-input"
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        checked={checked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        disabled={disabled}
      />
      <span className="check-box" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="m5.5 12.5 4 4 9-9.5" />
        </svg>
      </span>
      <span className="check-text">
        <b>{title}</b>
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

/**
 * One choice out of a few, as capsules. "mine" marks the person's own
 * current choice in ultramarine; "ink" is for filters and settings.
 */
export function ChoiceChips({
  name,
  legend,
  options,
  defaultValue,
  tone = "ink",
  columns,
  hideLegend,
}: {
  name: string;
  legend: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  tone?: "ink" | "mine";
  columns?: number;
  hideLegend?: boolean;
}) {
  return (
    <fieldset className="choice">
      <legend className={hideLegend ? "sr-only" : undefined}>{legend}</legend>
      <div
        className={`choice-chips tone-${tone}`}
        style={
          columns
            ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
            : undefined
        }
        data-grid={columns ? "" : undefined}
      >
        {options.map((o) => (
          <label key={o.value} className="choice-chip">
            <input
              className="control-input"
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={o.value === defaultValue}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// The usual Ukrainian short month names, for the label over a month's first day.
const MONTHS_SHORT = [
  "січ.",
  "лют.",
  "бер.",
  "квіт.",
  "трав.",
  "черв.",
  "лип.",
  "серп.",
  "вер.",
  "жовт.",
  "лист.",
  "груд.",
];

/** Days from today, as tiles like the booking page; «Без дати» first. */
export function DateField({
  name,
  legend,
  today,
  days = 62,
  defaultValue,
  error,
}: {
  name: string;
  legend: ReactNode;
  today: string;
  days?: number;
  defaultValue: string | null;
  error?: string;
}) {
  const list = Array.from({ length: days }, (_, i) => addDays(today, i));
  // An existing date outside the window (already past, or far ahead) stays choosable.
  if (defaultValue && !list.includes(defaultValue)) list.unshift(defaultValue);
  const [value, setValue] = useState(defaultValue ?? "");
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    row.current
      ?.querySelector<HTMLElement>("input:checked")
      ?.closest("label")
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, []);
  return (
    <fieldset className="field-row date-field">
      <legend>{legend}</legend>
      <div className="date-tiles" ref={row}>
        <label className="day-tile none">
          <input
            className="control-input"
            type="radio"
            name={name}
            value=""
            defaultChecked={!defaultValue}
            onChange={() => setValue("")}
          />
          <span>
            <b>
              Без
              <br />
              дати
            </b>
          </span>
        </label>
        {list.map((d) => {
          const month = MONTHS_SHORT[Number(d.slice(5, 7)) - 1];
          return (
            <label className="day-tile" key={d} aria-label={dateLong(d)}>
              <input
                className="control-input"
                type="radio"
                name={name}
                value={d}
                defaultChecked={d === defaultValue}
                onChange={() => setValue(d)}
              />
              <span>
                <small>
                  {d === today
                    ? "Сьогодні"
                    : d === addDays(today, 1)
                      ? "Завтра"
                      : WEEKDAYS_SHORT[weekdayIndex(d)]}
                </small>
                <b>{dayOfMonth(d)}</b>
                <i>{month}</i>
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <small className="field-error">{error}</small>
      ) : (
        <small>
          {value
            ? `Обрано: ${dateLong(value)}`
            : "Для подій: зборів, прибирання, відключень. Новину можна без дати."}
        </small>
      )}
    </fieldset>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/**
 * Time from the phone's own picker (the wheel on iPhone), dressed as our
 * field: the real <input type="time"> lies invisibly over it and takes the
 * tap. Without JavaScript the input simply shows as it is.
 */
export function TimeField({
  name,
  defaultValue,
  error,
}: {
  name: string;
  defaultValue: number | null;
  error?: string;
}) {
  const [value, setValue] = useState(
    defaultValue === null ? "" : fmt(defaultValue),
  );
  const [live, setLive] = useState(false);
  useEffect(() => setLive(true), []);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="field-row">
      <label htmlFor={name}>
        Час <span className="opt">необовʼязково</span>
      </label>
      <div className={live ? "time-field live" : "time-field"}>
        {live && (
          <span className="time-face" aria-hidden="true">
            <Icon name="clock" small />
            <span className={value ? undefined : "empty"}>
              {value || "Без часу"}
            </span>
          </span>
        )}
        <input
          ref={input}
          id={name}
          name={name}
          type="time"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
          onChange={(e) => setValue(e.target.value)}
          onClick={() => {
            // Desktop browsers open their picker only from a small icon.
            try {
              input.current?.showPicker();
            } catch {
              // Not supported: the input still takes typing.
            }
          }}
        />
        {live && value && (
          <button
            type="button"
            className="time-clear"
            aria-label="Прибрати час"
            onClick={() => setValue("")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 7l10 10M17 7 7 17" />
            </svg>
          </button>
        )}
      </div>
      {error && (
        <small className="field-error" id={`${name}-error`}>
          {error}
        </small>
      )}
    </div>
  );
}

/**
 * A destructive submit that asks first, in place, never in a browser dialog.
 * "inline": the button turns into the question with «Так, …» and «Ні».
 * "arm": for small buttons inside rows; the first tap turns it into «yes»,
 * the second submits, and it settles back after a few seconds.
 * Without JavaScript the button submits at once.
 */
export function ConfirmButton({
  name,
  value,
  className,
  children,
  question,
  yes,
  variant = "inline",
  label,
}: {
  name?: string;
  value?: string;
  className: string;
  children: ReactNode;
  question: string;
  yes: string;
  variant?: "inline" | "arm";
  label?: string;
}) {
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking || variant !== "arm") return;
    const t = setTimeout(() => setAsking(false), 5000);
    return () => clearTimeout(t);
  }, [asking, variant]);

  if (variant === "arm")
    return (
      <button
        className={`${className}${asking ? " is-armed" : ""}`}
        type="submit"
        name={name}
        value={value}
        aria-label={asking ? `${question} ${yes}` : label}
        onClick={(e) => {
          if (!asking) {
            e.preventDefault();
            setAsking(true);
          }
        }}
        onBlur={() => setAsking(false)}
      >
        {asking ? yes : children}
      </button>
    );

  if (!asking)
    return (
      <button
        className={className}
        type="submit"
        name={name}
        value={value}
        aria-label={label}
        onClick={(e) => {
          e.preventDefault();
          setAsking(true);
        }}
      >
        {children}
      </button>
    );
  return (
    <span className="confirm" role="group" aria-label={question}>
      <span className="confirm-q">{question}</span>
      <span className="confirm-actions">
        <button
          className="btn btn-danger"
          type="submit"
          name={name}
          value={value}
          autoFocus
        >
          {yes}
        </button>
        <button
          className="btn btn-soft"
          type="button"
          onClick={() => setAsking(false)}
        >
          Ні
        </button>
      </span>
    </span>
  );
}
