"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  briefExamples,
  type BriefFields,
  type BriefValidation,
  validateBrief,
} from "@/lib/brief";
import type { DiscoveryRequest } from "@/lib/contracts";

export function BusinessBriefForm({
  values,
  onChange,
  onSubmit,
  submitting,
}: {
  values: BriefFields;
  onChange: (field: keyof BriefFields, value: string) => void;
  onSubmit: (request: DiscoveryRequest) => void;
  submitting: boolean;
}) {
  const [validation, setValidation] = useState<BriefValidation | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!validation?.invalidFields.length) return;
    const target = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.focus();
    }
  }, [validation]);

  function change(field: keyof BriefFields, value: string) {
    onChange(field, value);
    if (validation) setValidation(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateBrief(values);
    setValidation(result);
    if (result.request) onSubmit(result.request);
  }

  function invalid(field: keyof BriefFields): boolean {
    return validation?.invalidFields.includes(field) ?? false;
  }

  function inputClass(field: keyof BriefFields): string {
    return `mt-2 w-full rounded-lg border bg-paper px-3 py-2.5 font-normal ${
      invalid(field) ? "border-rose-700 ring-2 ring-rose-100" : "border-line"
    }`;
  }

  return (
    <form
      className="mt-8 space-y-6 rounded-xl border border-line bg-white p-5 sm:p-8"
      noValidate
      onSubmit={submit}
      ref={formRef}
    >
      <fieldset>
        <legend className="text-sm font-semibold">Not sure? Try an example</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {briefExamples.map((example) => (
            <button
              className="min-h-10 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-forest hover:bg-paper"
              key={example.label}
              onClick={() => {
                Object.keys(example.fields).forEach((key) => {
                  const field = key as keyof BriefFields;
                  onChange(field, example.fields[field]);
                });
                setValidation(null);
              }}
              type="button"
            >
              {example.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-600">
          Examples fill the form only. Review and edit every field before you submit.
        </p>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Business name <span className="text-rose-700">* required</span>
          <input
            aria-invalid={invalid("businessName")}
            autoComplete="organization"
            className={inputClass("businessName")}
            maxLength={160}
            onChange={(event) => change("businessName", event.target.value)}
            placeholder="e.g. Your business name"
            required
            value={values.businessName}
          />
        </label>
        <label className="block text-sm font-semibold">
          Industry
          <input
            className={inputClass("industry")}
            maxLength={160}
            onChange={(event) => change("industry", event.target.value)}
            placeholder="e.g. independent fashion"
            value={values.industry}
          />
        </label>
        <label className="block text-sm font-semibold">
          City <span className="text-rose-700">* city or target market required</span>
          <input
            aria-invalid={invalid("city")}
            autoComplete="address-level2"
            className={inputClass("city")}
            maxLength={120}
            onChange={(event) => change("city", event.target.value)}
            placeholder="e.g. Your city"
            value={values.city}
          />
        </label>
        <label className="block text-sm font-semibold">
          Broader target market
          <input
            aria-invalid={invalid("targetMarket")}
            className={inputClass("targetMarket")}
            maxLength={240}
            onChange={(event) => change("targetMarket", event.target.value)}
            placeholder="e.g. people who live or work nearby"
            value={values.targetMarket}
          />
        </label>

        <div className="sm:col-span-2">
          <p className="text-sm font-semibold text-slate-900" id="business-identification-help">
            Add a website OR a short description <span className="text-rose-700">* required</span>
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Either one is enough; you do not need to provide both.
          </p>
        </div>
        <label className="block text-sm font-semibold sm:col-span-2">
          Website (or short description)
          <input
            aria-describedby="business-identification-help"
            aria-invalid={invalid("website")}
            autoComplete="url"
            className={inputClass("website")}
            onChange={(event) => change("website", event.target.value)}
            placeholder="https://example.com"
            type="url"
            value={values.website}
          />
        </label>
        <label className="block text-sm font-semibold sm:col-span-2">
          Short description (or website)
          <textarea
            aria-describedby="business-identification-help"
            aria-invalid={invalid("identifyingInfo")}
            className={inputClass("identifyingInfo")}
            maxLength={1000}
            onChange={(event) => change("identifyingInfo", event.target.value)}
            placeholder="A few words that distinguish your business"
            value={values.identifyingInfo}
          />
        </label>
        <label className="block text-sm font-semibold sm:col-span-2">
          Collaboration goal <span className="text-rose-700">* required</span>
          <textarea
            aria-invalid={invalid("goal")}
            className={inputClass("goal")}
            maxLength={2000}
            minLength={10}
            onChange={(event) => change("goal", event.target.value)}
            placeholder="e.g. What would a useful, low-risk collaboration help you learn or do?"
            required
            value={values.goal}
          />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">
          Budget range (USD) <span className="font-normal text-slate-600">* required</span>
        </legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Minimum
            <input
              aria-invalid={invalid("budgetMin")}
              className={inputClass("budgetMin")}
              min="0"
              onChange={(event) => change("budgetMin", event.target.value)}
              placeholder="e.g. 0"
              type="number"
              value={values.budgetMin}
            />
          </label>
          <label className="text-sm">
            Maximum
            <input
              aria-invalid={invalid("budgetMax")}
              className={inputClass("budgetMax")}
              min="0"
              onChange={(event) => change("budgetMax", event.target.value)}
              placeholder="e.g. 500"
              type="number"
              value={values.budgetMax}
            />
          </label>
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Event requirements
          <textarea
            aria-invalid={invalid("requirements")}
            className={inputClass("requirements")}
            placeholder={"e.g. One item per line\nA short in-person event"}
            onChange={(event) => change("requirements", event.target.value)}
            value={values.requirements}
          />
        </label>
        <label className="block text-sm font-semibold">
          Constraints
          <textarea
            aria-invalid={invalid("constraints")}
            className={inputClass("constraints")}
            placeholder={"e.g. One item per line\nKeep upfront costs low"}
            onChange={(event) => change("constraints", event.target.value)}
            value={values.constraints}
          />
        </label>
      </div>

      <label className="block text-sm font-semibold">
        Optional seed brands (up to 3)
        <textarea
          aria-invalid={invalid("seeds")}
          className={inputClass("seeds")}
          placeholder={"e.g. One brand per line\nA brand your customers like"}
          onChange={(event) => change("seeds", event.target.value)}
          value={values.seeds}
        />
        <span className="mt-1 block text-xs font-normal leading-5 text-slate-600">
          If Qloo doesn&apos;t know your brand, name brands your customers like.
        </span>
      </label>

      {validation?.message && (
        <p
          aria-live="assertive"
          className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900"
          role="alert"
        >
          {validation.message}
        </p>
      )}
      <button
        className="w-full rounded-lg bg-forest px-5 py-3 font-semibold text-white hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        disabled={submitting}
        type="submit"
      >
        Discover partners
      </button>
    </form>
  );
}
