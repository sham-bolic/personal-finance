type FormFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
    id: string;
    label: string;
};

export default function FormField({ id, label, ...inputProps }: FormFieldProps) {
    return (
        <div>
            <label htmlFor={id} className="text-sm font-medium">
                {label}
            </label>
            <input
                id={id}
                name={id}
                className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10"
                {...inputProps}
            />
        </div>
    );
}
