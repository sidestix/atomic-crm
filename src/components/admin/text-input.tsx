import {
  type InputProps,
  useInput,
  useResourceContext,
  FieldTitle,
} from "ra-core";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { cn, isValidDate } from "@/lib/utils.ts";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InputHelperText } from "@/components/admin/input-helper-text";
import { format } from "date-fns";

export type TextInputProps = InputProps & {
  multiline?: boolean;
} & React.ComponentProps<"textarea"> &
  React.ComponentProps<"input">;

export const TextInput = (props: TextInputProps) => {
  const resource = useResourceContext(props);
  const {
    label,
    source,
    multiline,
    className,
    validate: _validateProp,
    format: _formatProp,
    ...rest
  } = props;
  const { id, field, isRequired } = useInput(props);

  const value =
    props.type === "datetime-local"
      ? field.value && isValidDate(field.value)
        ? format(new Date(field.value), "yyyy-MM-dd'T'HH:mm")
        : undefined
      : props.type === "date"
        ? field.value && isValidDate(field.value)
          ? format(
              new Date(
                typeof field.value === "string" && field.value.length === 10
                  ? field.value + "T00:00:00"
                  : field.value
              ),
              "yyyy-MM-dd"
            )
          : undefined
        : field.value;

  return (
    <FormField id={id} className={cn(className, "w-full")} name={field.name}>
      {label !== false && (
        <FormLabel>
          <FieldTitle
            label={label}
            source={source}
            resource={resource}
            isRequired={isRequired}
          />
        </FormLabel>
      )}
      <FormControl>
        {multiline ? (
          <Textarea {...rest} {...field} value={value} />
        ) : (
          <Input {...rest} {...field} value={value} />
        )}
      </FormControl>
      <InputHelperText helperText={props.helperText} />
      <FormError />
    </FormField>
  );
};
