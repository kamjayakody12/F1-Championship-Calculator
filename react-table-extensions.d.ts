// react-table-extensions.d.ts
import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // Now every ColumnDef’s meta can include className
  interface ColumnMeta<TData, TValue> {
    className?: string;
  }
}
