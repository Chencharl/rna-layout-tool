import type { TableRow } from "@/lib/types";

type RNATableProps = {
  rows: TableRow[];
  onBaseChange: (pos: number, value: string) => void;
  onCoordinateChange: (pos: number, key: "x" | "y", value: number) => void;
  onLabelChange: (
    pos: number,
    key: "text" | "color" | "dx" | "dy",
    value: string | number,
  ) => void;
  onRemoveLabel: (pos: number) => void;
};

export function RNATable({
  rows,
  onBaseChange,
  onCoordinateChange,
  onLabelChange,
  onRemoveLabel,
}: RNATableProps) {
  return (
    <section className="table-panel">
      <div className="section-heading">
        <h2>Position Table</h2>
        <p>Fast edits for bases, coordinates, and publication labels.</p>
      </div>
      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Pos</th>
              <th>Base</th>
              <th>X</th>
              <th>Y</th>
              <th>Label</th>
              <th>Color</th>
              <th>dx</th>
              <th>dy</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.pos}>
                <td>{row.pos}</td>
                <td>
                  <input
                    value={row.base}
                    onChange={(event) => onBaseChange(row.pos, event.target.value)}
                    aria-label={`Base ${row.pos}`}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={row.x}
                    onChange={(event) =>
                      onCoordinateChange(row.pos, "x", Number(event.target.value))
                    }
                    aria-label={`X ${row.pos}`}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={row.y}
                    onChange={(event) =>
                      onCoordinateChange(row.pos, "y", Number(event.target.value))
                    }
                    aria-label={`Y ${row.pos}`}
                  />
                </td>
                <td>
                  <input
                    value={row.labelText}
                    placeholder="Optional"
                    onChange={(event) =>
                      onLabelChange(row.pos, "text", event.target.value)
                    }
                    aria-label={`Label ${row.pos}`}
                  />
                </td>
                <td>
                  <input
                    value={row.labelColor}
                    onChange={(event) =>
                      onLabelChange(row.pos, "color", event.target.value)
                    }
                    aria-label={`Label color ${row.pos}`}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={row.labelDx}
                    onChange={(event) =>
                      onLabelChange(row.pos, "dx", Number(event.target.value))
                    }
                    aria-label={`Label dx ${row.pos}`}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={row.labelDy}
                    onChange={(event) =>
                      onLabelChange(row.pos, "dy", Number(event.target.value))
                    }
                    aria-label={`Label dy ${row.pos}`}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => onRemoveLabel(row.pos)}
                    disabled={!row.labelText}
                  >
                    Clear
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
