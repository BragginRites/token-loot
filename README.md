# Token Loot

A powerful and intuitive loot distribution system for Foundry VTT that automatically grants randomized loot to tokens when they're created.

## ✨ Features

### 🎲 **Smart Loot Distribution**
- **Automatic loot generation** when tokens are placed on the scene
- **Flexible quantity ranges** with min/max item counts
- **Weighted chance system** for rare and common items
- **Currency distribution** with dice expressions (e.g., `2d6*10` gold)
- **Duplicate control** - allow or prevent duplicate items per actor

### 🎯 **Intuitive Group Manager**
- **Visual drag-and-drop interface** for managing loot groups
- **Actor assignment** by dragging actors directly into groups  
- **Item management** by dragging items from compendiums or your world
- **Distribution blocks** for organizing different loot categories
- **Real-time preview** of group configurations

### ⚡ **Power User Features**
- **Shift+Click to skip confirmations** - Hold Shift while deleting to bypass confirmation dialogs
- **Batch item import** from folders with customizable settings
- **Resizable and draggable** group manager window
- **Auto-save** with deferred writing for performance
- **GM-only chat summaries** of granted loot

### 🔧 **Advanced Configuration**
- **Multiple distribution modes**: "All items" or "Chance-based" selection
- **Item quantity controls** with separate min/max values per item
- **Equipment automation** - auto-equip and auto-attune options
- **Currency expressions** supporting complex dice formulas
- **Actor filtering** with UUID-based targeting

## 🚀 Quick Start

### Requirements
- Foundry VTT v13+
- D&D 5e System v5.1+

### Setup
1. **Enable the module** in your world
2. **Open the Loot Group Manager** via Module Settings → Token Loot
3. **Create your first group** by clicking "Add Loot Group"
4. **Drag actors** from the sidebar into the group's actor area
5. **Drag items** from compendiums into distribution blocks
6. **Configure chances and quantities** as desired

## 💡 Pro Tips

- **Hold Shift** while clicking delete buttons to skip confirmation dialogs
- **Use dice expressions** in currency fields: `1d4`, `2d6*10`, `10-50`
- **Drag entire folders** of items for bulk import with batch settings
- **Create multiple distribution blocks** to organize different item categories
- **Set different chance percentages** to create rare vs common loot tiers

Notes:
- Only the first group containing the actor is applied.
- Posts a GM-only chat summary.
- Granted items are flagged with `flags.token-loot.granted`.
