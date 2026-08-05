import React from 'react';
import { ChevronLeft, ChevronRight, ChevronFirst, ChevronLast } from 'lucide-react';
import Button from './Button';

const Pagination = ({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  showFirstLast = true,
  showPrevNext = true,
  maxVisiblePages = 5,
  className = '',
  'aria-label': ariaLabel = 'Pagination',
}) => {
  if (totalPages <= 1) return null;

  const pages = React.useMemo(() => {
    const pages = [];
    const half = Math.floor(maxVisiblePages / 2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + maxVisiblePages - 1);

    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [currentPage, totalPages, maxVisiblePages]);

  return (
    <nav
      className={`flex items-center justify-center gap-2 ${className}`}
      aria-label={ariaLabel}
    >
      {showFirstLast && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          aria-label="Go to first page"
          aria-disabled={currentPage === 1}
        >
          <ChevronFirst className="h-4 w-4" />
        </Button>
      )}

      {showPrevNext && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Go to previous page"
          aria-disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {pages.map((page, index) => (
        <Button
          key={page}
          variant={page === currentPage ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => onPageChange(page)}
          aria-label={`Go to page ${page}`}
          aria-current={page === currentPage ? 'page' : undefined}
          className="min-w-[40px]"
        >
          {page}
        </Button>
      ))}

      {pages.length > 0 && pages[pages.length - 1] < totalPages && (
        <span className="px-2 text-text-muted" aria-hidden="true">...</span>
      )}

      {showPrevNext && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Go to next page"
          aria-disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {showFirstLast && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          aria-label="Go to last page"
          aria-disabled={currentPage === totalPages}
        >
          <ChevronLast className="h-4 w-4" />
        </Button>
      )}
    </nav>
  );
};

Pagination.displayName = 'Pagination';

export default Pagination;