import { useState } from "react";
import { Plus, ChevronRight, ChevronDown, Trash2, Edit2, Check, X, Folder, FolderOpen } from "lucide-react";
import { ClassItem } from "./ClassItem";
import type { PackageItemProps } from "./types";

export function PackageItem({
  pkg,
  nodes,
  childPackages,
  allPackages,
  allNodes,
  isEditing,
  editingName,
  onEditingNameChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onAddSubPackage,
  onClassClick,
  isDark,
  t,
  level,
}: PackageItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const paddingLeft = `${level * 12 + 12}px`;

  return (
    <div className={`border-b ${isDark ? 'border-[#2d2d2d]' : 'border-[#e0e0e0]'}`}>
      <div 
        className={`flex items-center gap-2 px-3 py-2 group ${isDark ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#e8e8e8]'}`}
        style={{ paddingLeft }}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`p-0.5 rounded ${isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-[#d0d0d0]'}`}
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {isExpanded ? <FolderOpen className="w-4 h-4 text-[#dcb67a]" /> : <Folder className="w-4 h-4 text-[#dcb67a]" />}

        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={editingName}
              onChange={(e) => onEditingNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEdit();
                if (e.key === "Escape") onCancelEdit();
              }}
              className={`flex-1 px-2 py-0.5 text-sm rounded border focus:outline-none ${
                isDark 
                  ? 'bg-[#3c3c3c] text-[#cccccc] border-[#454545] focus:border-blue-500' 
                  : 'bg-white text-[#383838] border-[#d0d0d0] focus:border-blue-600'
              }`}
              autoFocus
            />
            <button onClick={onSaveEdit} className={`p-0.5 text-green-500 rounded ${isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-[#d0d0d0]'}`}>
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={onCancelEdit} className={`p-0.5 text-red-500 rounded ${isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-[#d0d0d0]'}`}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <>
            <span className="flex-1 text-sm font-medium">{pkg.name}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onAddSubPackage(pkg.id)}
                className={`p-1 rounded ${isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-[#d0d0d0]'}`}
                title="Añadir Subpaquete"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onStartEdit(pkg.id, pkg.name)}
                className={`p-1 rounded ${isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-[#d0d0d0]'}`}
                title={t("sidebar.rename")}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onDelete}
                className={`p-1 rounded text-red-400 ${isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-[#d0d0d0]'}`}
                title={t("sidebar.delete")}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>

      {isExpanded && (
        <div>
          {nodes.length > 0 && (
            <div style={{ paddingLeft: `${level * 12 + 24}px` }}>
              {nodes.map((node) => (
                <ClassItem key={node.id} node={node} onClassClick={onClassClick} isDark={isDark} />
              ))}
            </div>
          )}

          {childPackages.map((childPkg) => (
            <PackageItem
              key={childPkg.id}
              pkg={childPkg}
              nodes={allNodes.filter((n) => n.data.package === childPkg.name)}
              childPackages={allPackages.filter(p => p.parentId === childPkg.id)}
              allPackages={allPackages}
              allNodes={allNodes}
              isEditing={isEditing}
              editingName={editingName}
              onEditingNameChange={onEditingNameChange}
              onStartEdit={onStartEdit}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              onDelete={onDelete}
              onAddSubPackage={onAddSubPackage}
              onClassClick={onClassClick}
              isDark={isDark}
              t={t}
              level={level + 1}
            />
          ))}

          {nodes.length === 0 && childPackages.length === 0 && (
            <div 
              className={`px-3 py-2 text-xs italic ${isDark ? 'text-[#858585]' : 'text-[#9e9e9e]'}`}
              style={{ paddingLeft: `${level * 12 + 24}px` }}
            >
              {t("sidebar.noClasses")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
