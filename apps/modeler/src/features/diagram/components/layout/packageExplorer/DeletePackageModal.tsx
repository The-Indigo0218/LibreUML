import type { DeletePackageModalProps } from "./types";

export function DeletePackageModal({
  isOpen,
  packageName,
  hasClasses,
  classCount,
  onConfirm,
  onCancel,
  isDark,
  t,
}: DeletePackageModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`rounded-xl shadow-2xl w-full max-w-md p-6 ${
        isDark ? 'bg-[#252526] border border-[#3e3e3e]' : 'bg-white border border-[#e0e0e0]'
      }`}>
        <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-[#cccccc]' : 'text-[#383838]'}`}>
          {t("modals.confirmation.deletePackageTitle")}
        </h2>

        {hasClasses ? (
          <>
            <p className={`mb-6 ${isDark ? 'text-[#9e9e9e]' : 'text-[#757575]'}`}>
              {t("modals.confirmation.deletePackageWithClassesCount", { name: packageName, count: classCount })}
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => onConfirm(true)}
                className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
                  isDark ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                {t("modals.confirmation.deletePackageAndClasses")}
              </button>

              <button
                onClick={() => onConfirm(false)}
                className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
                  isDark ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {t("modals.confirmation.deletePackageKeepClasses")}
              </button>

              <button
                onClick={onCancel}
                className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
                  isDark ? 'bg-[#3c3c3c] hover:bg-[#4a4a4a] text-[#cccccc]' : 'bg-[#e0e0e0] hover:bg-[#d0d0d0] text-[#383838]'
                }`}
              >
                {t("modals.confirmation.cancel")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={`mb-6 ${isDark ? 'text-[#9e9e9e]' : 'text-[#757575]'}`}>
              {t("modals.confirmation.deletePackageEmpty", { name: packageName })}
            </p>

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isDark ? 'bg-[#3c3c3c] hover:bg-[#4a4a4a] text-[#cccccc]' : 'bg-[#e0e0e0] hover:bg-[#d0d0d0] text-[#383838]'
                }`}
              >
                {t("modals.confirmation.cancel")}
              </button>

              <button
                onClick={() => onConfirm(false)}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isDark ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                {t("modals.confirmation.confirm")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
