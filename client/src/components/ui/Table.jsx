import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

const Table = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <div ref={ref} className={`overflow-x-auto rounded-2xl border border-slate-800 ${className}`} {...props}>
    <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
      {children}
    </table>
  </div>
));
Table.displayName = 'Table';

const TableHeader = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <thead ref={ref} className={`bg-slate-900/50 ${className}`} {...props}>
    {children}
  </thead>
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <tbody ref={ref} className={`divide-y divide-slate-850 ${className}`} {...props}>
    {children}
  </tbody>
));
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <tfoot ref={ref} className={`bg-slate-900/30 ${className}`} {...props}>
    {children}
  </tfoot>
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef(({ children, className = '', hover = true, selected = false, ...props }, ref) => (
  <tr
    ref={ref}
    className={`
      transition-colors
      ${hover ? 'hover:bg-slate-900/30' : ''}
      ${selected ? 'bg-blue-500/10 border-l-4 border-l-blue-500' : ''}
      ${className}
    `}
    {...props}
  >
    {children}
  </tr>
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef(({ children, className = '', sortable = false, onSort, sortDirection, ...props }, ref) => (
  <th
    ref={ref}
    scope="col"
    className={`
      px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400
      ${sortable ? 'cursor-pointer select-none hover:text-slate-200' : ''}
      ${className}
    `}
    onClick={onSort}
    aria-sort={sortDirection ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
    {...props}
  >
    <div className="flex items-center gap-1.5">
      {children}
      {sortable && (
        <span className="inline-flex">
          {sortDirection === 'asc' ? (
            <ChevronUp className="h-4 w-4 text-blue-500" />
          ) : sortDirection === 'desc' ? (
            <ChevronDown className="h-4 w-4 text-blue-500" />
          ) : (
            <ChevronUp className="h-4 w-4 text-slate-600" />
          )}
        </span>
      )}
    </div>
  </th>
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef(({ children, className = '', align = 'left', ...props }, ref) => (
  <td
    ref={ref}
    className={`
      px-6 py-4 text-slate-300
      ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : ''}
      ${className}
    `}
    {...props}
  >
    {children}
  </td>
));
TableCell.displayName = 'TableCell';

const TableSortableHeader = ({ children, onSort, sortDirection, ...props }) => (
  <TableHead sortable onSort={onSort} sortDirection={sortDirection} {...props}>
    {children}
  </TableHead>
);

export { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableSortableHeader };
export default Table;