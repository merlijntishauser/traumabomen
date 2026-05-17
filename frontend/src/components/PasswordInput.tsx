import { Eye, EyeOff } from "lucide-react";
import { type ComponentProps, type Ref, useState } from "react";
import { useTranslation } from "react-i18next";
import "./PasswordInput.css";

interface PasswordInputProps extends Omit<ComponentProps<"input">, "type"> {
  showLabel?: string;
  hideLabel?: string;
  ref?: Ref<HTMLInputElement>;
}

export function PasswordInput({ showLabel, hideLabel, style, ref, ...props }: PasswordInputProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  const show = showLabel ?? t("common.showPassword");
  const hide = hideLabel ?? t("common.hidePassword");
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="password-input">
      <input
        ref={ref}
        {...props}
        type={visible ? "text" : "password"}
        style={{ ...style, paddingRight: 36 }}
      />
      <button
        type="button"
        className="password-input__toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hide : show}
        tabIndex={-1}
      >
        <Icon size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
