"use client";

import * as React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export interface ResultRow {
  position: number;
  driverId: string;
  pole: boolean;
  fastestLap: boolean;
}

// Points mapping for finishing positions 1 to 10
const positionPointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

// Inline column definitions
const columns = [
  {
    accessorKey: "position",
    header: "Pos",
    cell: ({ row }: any) => row.original.position,
    enableSorting: false,
  },
  {
    accessorKey: "driverId",
    header: "Driver",
    cell: ({ row, table }: any) => {
      const drivers = table.options.meta?.drivers || [];
      const currentValue = row.original.driverId ? row.original.driverId : "none";
      return (
        <Select
          value={currentValue}
          onValueChange={(newDriverId) => {
            table.options.meta?.updateDriver?.(
              row.original.position,
              newDriverId === "none" ? "" : newDriverId
            );
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="-- Select Driver --" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">-- Select Driver --</SelectItem>
            {drivers.map((driver: any) => (
              <SelectItem key={driver._id} value={driver._id}>
                {driver.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "pole",
    header: "Pole",
    cell: ({ row, table }: any) => (
      <Checkbox
        checked={row.original.pole}
        onCheckedChange={() => table.options.meta?.togglePole?.(row.original.position)}
        aria-label="Pole"
      />
    ),
    enableSorting: false,
  },
  {
    accessorKey: "fastestLap",
    header: "Fastest Lap",
    cell: ({ row, table }: any) => (
      <Checkbox
        checked={row.original.fastestLap}
        onCheckedChange={() => table.options.meta?.toggleFastestLap?.(row.original.position)}
        aria-label="Fastest Lap"
      />
    ),
    enableSorting: false,
  },
  {
    id: "points",
    header: "Points",
    cell: ({ row }: any) => {
      const { position, pole, fastestLap } = row.original;
      const basePoints = position <= 10 ? positionPointsMapping[position - 1] : 0;
      const bonusPoints = (pole ? 1 : 0) + (fastestLap ? 1 : 0);
      return basePoints + bonusPoints;
    },
    enableSorting: false,
  },
];

interface DataTableProps {
  data: ResultRow[];
  drivers: any[];
  updateDriver: (position: number, newDriverId: string) => void;
  togglePole: (position: number) => void;
  toggleFastestLap: (position: number) => void;
}

export default function DataTable({
  data: initialData,
  drivers,
  updateDriver,
  togglePole,
  toggleFastestLap,
}: DataTableProps) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 50 });

  const table = useReactTable({
    data: initialData,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    meta: { drivers, updateDriver, togglePole, toggleFastestLap },
    getRowId: (row) => row.position.toString(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <table className="min-w-full border-collapse">
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id} className="border p-2">
                {header.isPlaceholder
                  ? null
                  : typeof header.column.columnDef.header === "function"
                  ? header.column.columnDef.header(header.getContext())
                  : header.column.columnDef.header}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id} className="border p-2">
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} className="border p-2">
                {typeof cell.column.columnDef.cell === "function"
                  ? cell.column.columnDef.cell(cell.getContext())
                  : cell.column.columnDef.cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
