interface DiffViewProps {
  before: string;
  after: string;
}

export default function DiffView({ before, after }: DiffViewProps) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="rounded-md border border-red-200/60 dark:border-red-800/40 bg-red-50 dark:bg-red-900/20 p-2 max-h-40 overflow-auto">
        <div className="mb-1 text-[10px] font-medium text-red-500 dark:text-red-400">
          原文
        </div>
        <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-200">
          {before}
        </div>
      </div>
      <div className="rounded-md border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20 p-2 max-h-40 overflow-auto">
        <div className="mb-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
          替换为
        </div>
        <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-200">
          {after}
        </div>
      </div>
    </div>
  );
}
