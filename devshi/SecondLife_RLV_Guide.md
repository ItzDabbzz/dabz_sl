# 🕹️ Restrained Love Viewer (RLV) & RLVa Deep Dive

A comprehensive and **highly technical guide** for Second Life users, creators, and scripters who want to master **RLV and RLVa**—covering protocol behavior, implementation differences, scripting details, and best practices for inventory folder structure.

---

## 📑 Table of Contents

- [🕹️ Restrained Love Viewer (RLV) \& RLVa Deep Dive](#️-restrained-love-viewer-rlv--rlva-deep-dive)
  - [📑 Table of Contents](#-table-of-contents)
  - [1. Introduction to RLV](#1-introduction-to-rlv)
    - [1.1 What RLV Actually Is](#11-what-rlv-actually-is)
    - [1.2 Historical Background](#12-historical-background)
    - [1.3 Viewer Compatibility](#13-viewer-compatibility)
  - [2. RLV vs RLVa](#2-rlv-vs-rlva)
    - [2.1 Design Philosophy](#21-design-philosophy)
    - [2.2 Debugging Tools \& Logging](#22-debugging-tools--logging)
    - [2.3 Differences in Command Handling](#23-differences-in-command-handling)
    - [2.4 User Experience Impact](#24-user-experience-impact)
  - [3. The RLV API \& Protocol](#3-the-rlv-api--protocol)
    - [3.1 Command Structure](#31-command-structure)
    - [3.2 Relay Objects \& Channel Usage](#32-relay-objects--channel-usage)
    - [3.3 Limitations \& Quirks](#33-limitations--quirks)
  - [4. Folder Structure in Depth](#4-folder-structure-in-depth)
    - [4.1 The `#RLV` Root Folder](#41-the-rlv-root-folder)
    - [4.2 Shared Folder Conventions](#42-shared-folder-conventions)
    - [4.3 Special Characters in Folder Names](#43-special-characters-in-folder-names)
    - [4.4 The `.outfits` \& `.core` Hierarchy](#44-the-outfits--core-hierarchy)
    - [4.5 “nostrip” Behavior \& Locking Mechanisms](#45-nostrip-behavior--locking-mechanisms)
    - [4.6 Folder Linking vs. Actual Folders](#46-folder-linking-vs-actual-folders)
    - [4.7 Viewer Indexing \& Performance Notes](#47-viewer-indexing--performance-notes)
  - [5. Advanced Inventory Management](#5-advanced-inventory-management)
    - [5.1 Modular Outfit Building](#51-modular-outfit-building)
    - [5.2 Mixed Mesh + Layer Workflows](#52-mixed-mesh--layer-workflows)
    - [5.3 Auto-Delivery from Devices](#53-auto-delivery-from-devices)
    - [5.4 Preventing Outfit Conflicts](#54-preventing-outfit-conflicts)
  - [6. Scripting with RLV](#6-scripting-with-rlv)
    - [6.1 LSL Relay Protocol Basics](#61-lsl-relay-protocol-basics)
    - [6.2 Channel Handling](#62-channel-handling)
    - [6.3 Example RLV Force-Wear Commands](#63-example-rlv-force-wear-commands)
    - [6.4 Security \& Safety Considerations](#64-security--safety-considerations)
  - [7. Known Viewer Differences](#7-known-viewer-differences)
  - [8. Troubleshooting \& Pitfalls](#8-troubleshooting--pitfalls)
  - [9. References](#9-references)
  - [📂 Example ASCII Folder Layout (Extended)](#-example-ascii-folder-layout-extended)

---

## 1. Introduction to RLV

### 1.1 What RLV Actually Is

- RLV is not a “feature” inside Second Life itself—it’s a **viewer-side extension**.
- It hooks into the viewer’s inventory management, attachment system, and chat handling.
- RLV allows **scripted objects** to control the avatar’s viewer through LSL commands relayed over special chat channels.

### 1.2 Historical Background

- Created by **Marine Kelley** around 2007 as a BDSM toolset.
- Originally limited to clothing restrictions, but expanded to **full control** over inventory, teleport, camera, and IMs.
- Inspired RLVa (alternative maintained by **Catznip Viewer** team).

### 1.3 Viewer Compatibility

- Officially supported in: Marine’s RLV viewer, Catznip (RLVa), Firestorm (with RLVa support).
- Unsupported in Linden Lab’s default viewer (no native RLV support).

---

## 2. RLV vs RLVa

### 2.1 Design Philosophy

- **RLV**: purist, strict, BDSM-oriented. Implements only what Marine considered valid.
- **RLVa**: pragmatic, debug-friendly, wider appeal. Implements additional features and “safer” defaults.

### 2.2 Debugging Tools & Logging

- RLVa includes **Active Restrictions** and **Command Console** panels.
- RLV does not expose this—more “black box.”

### 2.3 Differences in Command Handling

- **Folder naming**: RLV is stricter about hidden vs visible folders (`.`, `~`, `+` usage). RLVa is slightly more forgiving.
- **Attachment add/remove**: RLVa allows finer-grained handling of “add” vs “replace” operations.
- **Auto-creation of `#RLV`**: RLVa sometimes creates the folder automatically on login. RLV requires manual creation.
- **Performance**: RLVa caches folder lookups more efficiently when using large inventories.

### 2.4 User Experience Impact

- Users on RLV may find more things “just don’t work” without strict setup.
- Users on RLVa (e.g., Firestorm) get a smoother onboarding, at the cost of diverging slightly from Marine’s spec.

---

## 3. The RLV API & Protocol

### 3.1 Command Structure

- Commands are sent via **chat channels** (usually negative channel numbers).
- Format:

  ```txt
  [channel] /me command,param,param
  ```
  
- Example:

  ```txt
  @attach:foldername=force
  ```

### 3.2 Relay Objects & Channel Usage

- The **Relay** listens on channel `-1812221819` by default.
- Devices (e.g., cuffs, cages) send commands → Relay interprets → Viewer enforces restrictions.
- Relay acts as a **security layer**—the viewer itself won’t accept raw `@` commands without a relay.

### 3.3 Limitations & Quirks

- Commands are **stateless** unless reinforced—if you detach an item manually, some restrictions reset.
- Not all commands are implemented in all viewers (example: `@redirchat` works in RLVa, partially in RLV).
- Some restrictions persist after crash/logoff if not cleared properly.

---

## 4. Folder Structure in Depth

### 4.1 The `#RLV` Root Folder

- Must exist at inventory root.
- Name must be **exact**: `#RLV`. Case-sensitive.

### 4.2 Shared Folder Conventions

- Subfolders inside `#RLV` are directly exposed to RLV.
- Items can be force-worn, removed, or replaced by scripts.

### 4.3 Special Characters in Folder Names

- **Symbols have semantic meaning**:
- Use **symbols** to control behavior and improve navigation:
  - `\` (backslash) →  indicates a folder not to be worn directly but to access its subfolders.
  - `+` →  indicates “add only,” preventing replacement of existing attachments.
  - `+\` →  a combination—both navigable and add-only.
  - `.` (period) →  hides the folder from RLV except in specific contexts.
  - `~` →  denotes items folders sent automatically via scripted devices.
- Avoid problematic characters like `/`, `,`, `|` in folder names. Stick to safe symbols like `~!@#$%^&*()+-_={}[]\:;”‘.?`.

### 4.4 The `.outfits` & `.core` Hierarchy

- `.outfits` = reserved system folder.
- `.core` = auto-added “base outfit” (always worn).
- **Rules**:
  - Only lowest-level folders in `.outfits` are valid outfits.
  - `.core` is merged into every outfit swap.
  - Duplicate items between `.core` and outfits may cause “replace vs add” conflicts.

### 4.5 “nostrip” Behavior & Locking Mechanisms

- `nostrip` → item will not be removed by `@strip`.
- Lock (`@detach:folder=forbid`) → item cannot be detached by wearer or RLV.

### 4.6 Folder Linking vs. Actual Folders

- Folders must be real.
- Items inside can be **links** (symlinks).
- But nested **folder links** break RLV.

### 4.7 Viewer Indexing & Performance Notes

- RLV constantly **indexes** the `#RLV` hierarchy.
- Deep nesting = slower operations.
- Optimal: **3-4 levels max** for performance.

---

## 5. Advanced Inventory Management

### 5.1 Modular Outfit Building

- Build outfits like LEGO: body in `.core`, accessories in shared folders, themes in `.outfits`.

### 5.2 Mixed Mesh + Layer Workflows

- Keep **system alphas** in `.core`.
- Mesh clothing in `.outfits`.

### 5.3 Auto-Delivery from Devices

- Collars/cuffs often auto-create folders like `~CollarItems/`.
- These appear under `#RLV` automatically.

### 5.4 Preventing Outfit Conflicts

- Don’t repeat **unique items** in `.core` and outfits.
- Use `+` folders for add-only items (jewelry, tattoos).

---

## 6. Scripting with RLV

### 6.1 LSL Relay Protocol Basics

- Relays must detect **owner consent**.
- Consent = dialog box popup (“This device wants to control you”).

### 6.2 Channel Handling

- Default relay channel: `-1812221819`.
- Devices often randomize channels for session security.

### 6.3 Example RLV Force-Wear Commands

```lsl
// Force-wear "Bondage" outfit
llOwnerSay("@attach:Bondage=force");

// Strip all but nostrip items
llOwnerSay("@strip=force");
```

### 6.4 Security & Safety Considerations

- RLV is **viewer-only**. LL servers do not enforce it.
- Bad scripts can grief you if you don’t use a secure relay.
- Always verify relay settings before accepting control.

---

## 7. Known Viewer Differences

| Feature                          | RLV     | RLVa     |
| -------------------------------- | ------- | -------- |
| Debug Console                    | ❌      | ✅       |
| Auto-create `#RLV`               | ❌      | ✅       |
| Folder hiding symbols            | Strict  | Flexible |
| Command logging                  | Minimal | Verbose  |
| Performance w/ large inventories | Slower  | Faster   |

---

## 8. Troubleshooting & Pitfalls

- Multiple `#RLV` folders → undefined behavior.
- Misnamed `.outfits` → scripts won’t detect it.
- Inventory lag: large `#RLV` trees slow down login.
- “Phantom locks” → restrictions persisting after relog. Use `@clear` to reset.

---

## 9. References

- [Marine Kelley’s RLV API](https://wiki.secondlife.com/wiki/LSL_Protocol/RestrainedLoveAPI)
- [RLVa vs RLV – Catznip Wiki](https://wiki.catznip.com/index.php?title=RLVa_/_RLV_Differences)
- [Folder Setup Guide – Davro Sharkness](https://davrosharkness.wordpress.com/2018/01/31/rlv-folders/)
- [OpenCollar Outfits Documentation](https://opencollar.cc/docs/Outfits)
- Community Forum Threads on RLV setup and quirks

---

## 📂 Example ASCII Folder Layout (Extended)

```txt
Inventory/
└── #RLV/
    ├── \Accessories/
    │   ├── +Jewelry/
    │   └── +Piercings/
    ├── ~DeviceDrop/
    │   └── CollarScripts/
    ├── .outfits/
    │   ├── .core/
    │   │   ├── MeshBody (nostrip)
    │   │   ├── MeshHead (nostrip)
    │   │   ├── Eyes
    │   │   └── Collar
    │   ├── Schoolgirl/
    │   ├── LatexSuit/
    │   └── Chains/
    └── BondageGear/
        ├── +Cuffs/
        ├── +Blindfold/
        └── +Gag/
```
