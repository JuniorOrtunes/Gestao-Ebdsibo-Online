import { btn, btnDanger, btnGhost } from "./Shell";

type Props = {
  open: boolean;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDeleteModal({ open, isPending = false, onConfirm, onCancel }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-foreground">Confirmar exclusão</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Deseja realmente excluir este registro? Essa ação não poderá ser desfeita.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className={`${btnGhost} disabled:opacity-50`}
            onClick={onCancel}
            disabled={isPending}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={`${btnDanger} disabled:opacity-50`}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Re-export for convenience
export { btn };
