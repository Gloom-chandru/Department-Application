import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

const Table = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <div ref={ref} className={`overflow-x-auto rounded-xl border border-border-card bg-bg-card shadow-premium-sm ${className}`} {...props}>
    <table className="min-w-full divide-y divide-border-card text-left text-sm">
      {children}
    </table>
  </div>
));
Table.displayName = 'Table';

const TableHeader = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <thead ref={ref} className={`bg-bg-sidebar/45 border-b border-border-card ${className}`} {...props}>
    {children}
  </thead>
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <tbody ref={ref} className={`divide-y divide-border-card/50 ${className}`} {...props}>
    {children}
  </tbody>
));
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <tfoot ref={ref} className={`bg-bg-sidebar/35 border-t border-border-card ${className}`} {...props}>
    {children}
  </tfoot>
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef(({ children, className = '', hover = true, selected = false, ...props }, ref) => (
  <tr
    ref={ref}
    className={`
      transition-colors duration-150
      ${hover ? 'hover:bg-bg-sidebar/35' : ''}
      ${selected ? 'bg-primary-500/10 border-l-4 border-l-primary-500' : ''}
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
      px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-text-muted
      ${sortable ? 'cursor-pointer select-none hover:text-text-main transition-colors duration-150' : ''}
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
            <ChevronUp className="h-4 w-4 text-primary-500" />
          ) : sortDirection === 'desc' ? (
            <ChevronDown className="h-4 w-4 text-primary-500" />
          ) : (
            <ChevronUp className="h-4 w-4 text-text-muted/40" />
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
      px-6 py-3.5 text-text-main font-medium
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