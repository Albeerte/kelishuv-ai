"use client";
import { T } from "@/lib/i18n";
import type { SignatureBox } from "@/lib/kelishuv-types";

export function SignatureLayoutEditor({
  boxes,
  pageCount,
  onChange,
  disabled = false,
}: {
  boxes: SignatureBox[];
  pageCount: number;
  onChange: (boxes: SignatureBox[]) => void;
  disabled?: boolean;
}) {
  function change(index: number, key: keyof SignatureBox, value: number) {
    onChange(
      boxes.map((box, current) =>
        current === index ? { ...box, [key]: value } : box,
      ),
    );
  }
  return (
    <fieldset className="signature-layout-editor" disabled={disabled}>
      <legend>
        <T>Imzo joylashuvi</T>
      </legend>
      <p>
        <T>
          Imzo joylarini PDF pastki qismida suring yoki o‘lchamlarini kiriting.
          O‘zgarish yangi hujjat nusxasida saqlanadi.
        </T>
      </p>
      {boxes.map((box, index) => (
        <div className="signature-layout-row" key={box.role}>
          <strong>
            <T>
              {box.role === "FIRST_PARTY"
                ? "Birinchi taraf"
                : box.role === "SECOND_PARTY"
                  ? "Ikkinchi taraf"
                  : "Mediator"}
            </T>
          </strong>
          <label>
            <T>Sahifa</T>
            <input
              aria-label={`${box.role} page`}
              type="number"
              min={1}
              max={pageCount}
              value={box.page + 1}
              onChange={(event) =>
                change(index, "page", Number(event.target.value) - 1)
              }
            />
          </label>
          {(["x", "y", "width", "height"] as const).map((key) => (
            <label key={key}>
              {key === "width" ? (
                <T>Kenglik %</T>
              ) : key === "height" ? (
                <T>Balandlik %</T>
              ) : (
                `${key.toUpperCase()} %`
              )}
              <input
                aria-label={`${box.role} ${key}`}
                type="number"
                min={
                  key === "y"
                    ? 74
                    : key === "width"
                      ? 22
                      : key === "height"
                        ? 12
                        : 4
                }
                max={key === "width" ? 30 : key === "height" ? 18 : 94}
                step={0.1}
                value={Math.round(box[key] * 1000) / 10}
                onChange={(event) =>
                  change(index, key, Number(event.target.value) / 100)
                }
              />
            </label>
          ))}
        </div>
      ))}
    </fieldset>
  );
}
