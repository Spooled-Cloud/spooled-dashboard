/**
 * Tests for Table components
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './table';

describe('Table', () => {
  it('should render table element', () => {
    render(<Table data-testid="table" />);

    const table = screen.getByTestId('table');
    expect(table).toBeInTheDocument();
    expect(table.tagName).toBe('TABLE');
  });

  it('should apply custom className', () => {
    render(<Table data-testid="table" className="custom-table" />);

    const table = screen.getByTestId('table');
    expect(table).toHaveClass('custom-table');
  });

  it('should render children', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Cell content</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    expect(screen.getByText('Cell content')).toBeInTheDocument();
  });
});

describe('TableHeader', () => {
  it('should render thead element', () => {
    render(
      <Table>
        <TableHeader data-testid="header">
          <TableRow>
            <TableHead>Header</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    );

    const header = screen.getByTestId('header');
    expect(header).toBeInTheDocument();
    expect(header.tagName).toBe('THEAD');
  });

  it('should apply custom className', () => {
    render(
      <Table>
        <TableHeader data-testid="header" className="custom-header">
          <TableRow>
            <TableHead>Header</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    );

    const header = screen.getByTestId('header');
    expect(header).toHaveClass('custom-header');
  });
});

describe('TableBody', () => {
  it('should render tbody element', () => {
    render(
      <Table>
        <TableBody data-testid="body">
          <TableRow>
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    const body = screen.getByTestId('body');
    expect(body).toBeInTheDocument();
    expect(body.tagName).toBe('TBODY');
  });

  it('should apply custom className', () => {
    render(
      <Table>
        <TableBody data-testid="body" className="custom-body">
          <TableRow>
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    const body = screen.getByTestId('body');
    expect(body).toHaveClass('custom-body');
  });
});

describe('TableFooter', () => {
  it('should render tfoot element', () => {
    render(
      <Table>
        <TableFooter data-testid="footer">
          <TableRow>
            <TableCell>Footer</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    );

    const footer = screen.getByTestId('footer');
    expect(footer).toBeInTheDocument();
    expect(footer.tagName).toBe('TFOOT');
  });

  it('should apply custom className', () => {
    render(
      <Table>
        <TableFooter data-testid="footer" className="custom-footer">
          <TableRow>
            <TableCell>Footer</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    );

    const footer = screen.getByTestId('footer');
    expect(footer).toHaveClass('custom-footer');
  });
});

describe('TableRow', () => {
  it('should render tr element', () => {
    render(
      <Table>
        <TableBody>
          <TableRow data-testid="row">
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    const row = screen.getByTestId('row');
    expect(row).toBeInTheDocument();
    expect(row.tagName).toBe('TR');
  });

  it('should apply custom className', () => {
    render(
      <Table>
        <TableBody>
          <TableRow data-testid="row" className="custom-row">
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    const row = screen.getByTestId('row');
    expect(row).toHaveClass('custom-row');
  });

  it('should have hover styling', () => {
    render(
      <Table>
        <TableBody>
          <TableRow data-testid="row">
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    const row = screen.getByTestId('row');
    expect(row).toHaveClass('hover:bg-muted/50');
  });
});

describe('TableHead', () => {
  it('should render th element', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead data-testid="head">Header</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    );

    const head = screen.getByTestId('head');
    expect(head).toBeInTheDocument();
    expect(head.tagName).toBe('TH');
  });

  it('should apply custom className', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead data-testid="head" className="custom-head">
              Header
            </TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    );

    const head = screen.getByTestId('head');
    expect(head).toHaveClass('custom-head');
  });

  it('should render header content', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Column Name</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    );

    expect(screen.getByText('Column Name')).toBeInTheDocument();
  });
});

describe('TableCell', () => {
  it('should render td element', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell data-testid="cell">Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    const cell = screen.getByTestId('cell');
    expect(cell).toBeInTheDocument();
    expect(cell.tagName).toBe('TD');
  });

  it('should apply custom className', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell data-testid="cell" className="custom-cell">
              Cell
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    const cell = screen.getByTestId('cell');
    expect(cell).toHaveClass('custom-cell');
  });

  it('should render cell content', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Cell content here</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    expect(screen.getByText('Cell content here')).toBeInTheDocument();
  });
});

describe('TableCaption', () => {
  it('should render caption element', () => {
    render(
      <Table>
        <TableCaption data-testid="caption">Table description</TableCaption>
        <TableBody>
          <TableRow>
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    const caption = screen.getByTestId('caption');
    expect(caption).toBeInTheDocument();
    expect(caption.tagName).toBe('CAPTION');
  });

  it('should apply custom className', () => {
    render(
      <Table>
        <TableCaption data-testid="caption" className="custom-caption">
          Table description
        </TableCaption>
        <TableBody>
          <TableRow>
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    const caption = screen.getByTestId('caption');
    expect(caption).toHaveClass('custom-caption');
  });

  it('should render caption text', () => {
    render(
      <Table>
        <TableCaption>Jobs Table Description</TableCaption>
        <TableBody>
          <TableRow>
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    expect(screen.getByText('Jobs Table Description')).toBeInTheDocument();
  });
});

describe('Complete Table', () => {
  it('should render a complete table structure', () => {
    render(
      <Table>
        <TableCaption>List of users</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>John Doe</TableCell>
            <TableCell>john@example.com</TableCell>
            <TableCell>Admin</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Jane Smith</TableCell>
            <TableCell>jane@example.com</TableCell>
            <TableCell>User</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>Total: 2 users</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    );

    expect(screen.getByText('List of users')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('Total: 2 users')).toBeInTheDocument();
  });
});
