# UI Requirements

Binding on every UI change. **UI work follows this file strictly** — the agent does not invent
alternatives to what is written here. Section shape is fixed — see `format.md`.

Anything this file does not cover is still a design decision: it is settled at the **grill**, by the
human, before implementation. Never invented while coding.

## Contract

**Styling stack — one of two, decided per project**

The default is **Astryx + StyleX**. **Tailwind is the alternative, and only when the human explicitly
chose it for this project.** The two are exclusive — a project runs one stack, never a mixture. Under
the default, custom components are styled with **StyleX**; under Tailwind, Astryx and StyleX are not
used at all.

<Delete the stack this project does not use, so the file states one answer rather than a choice.>

**Component structure — atomic design, in a dedicated directory**

```text
<components-root>/
  atoms/        # indivisible primitives — button, input, icon, label
  molecules/    # small compositions of atoms with one job — field, search bar, card header
  organisms/    # self-contained sections composed of molecules and atoms
```

<Fill in the actual `<components-root>` path for this project.>

**Tokens**

Every style value is a token: colours, spacing, typography, radii, shadows, z-index, motion — defined
once and referenced by name.

<List the registries by their real paths and the token names an agent may use, so it can reference
them rather than approximate them. If the design system has a closed vocabulary — a fixed set of
typography roles, a fixed palette — state it here in full, with the values. This is the section a
static check is written against.>

**Layout and responsive**

<Breakpoints, grid, and the viewports every UI change must work at.>

**Design source of truth**

<A prototype, design file, or reference implementation, and how to read it — if one exists beyond
the component library. If a document has been superseded, say so here: a retired document that is
still described as current gets cited for years.>

## Tools

<The static check that enforces the contract above, by path, and the command that runs it. Naming it
here is what lets every rule below stay short: a rule a script can fail is worth more than the same
rule in bold.>

```bash
<the command — usually the build or the test run the check hangs off>
```

<The component library's docs URL. The design reference's path.>

## Guidance

Binding. Followed while writing, judged by the author — nothing reviews a diff against this section.

**Choosing components.** Reach for a custom component only when the library genuinely has nothing
that fits — not because the official one needs configuring, and not because writing one looks faster.
"There is no equivalent" is a claim to check against the docs, not to assume.

**Placing a component.** Put a new one at the lowest atomic level that fits. An "organism" that is
really one atom with props is a smell; so is an atom that reaches for page state.

**Choosing a token.** <Which role to use when two look plausible — the distinctions people get wrong.
A missing token is a stop, not a reason to compose one out of primitives.>

**Interaction states.** <Loading, empty, error, disabled, focus. The states that get forgotten and
then reported as bugs.>

**Content and tone.** <How text in the product reads.>

## Redlines

**A closed list, looked up — never judged.** Do not ask "is this a big deal?"; check whether the
action is on the list. If it is: **route around it, or stop and hand it to the human.** Never
proceed, never approximate, never decide on the human's behalf.

Every entry says which of the two it is — **forbidden outright**, or **not without the human's
explicit approval**. An entry that needs a read-through to apply is not a redline; write it as
Guidance instead (`format.md`, test 2).

1. **Changing a governed token registry** — adding, renaming, removing or retuning a value — not
   without the human's explicit approval. The registries are, by path, so this can be matched against
   a diff without judgement: `<path>`, `<path>`, `<path>` (the same paths listed in `## Contract`).
   A missing token is a stop; reaching for the component library's own primitive instead of asking is
   the evasion this entry exists to name.
2. **<A styling mechanism this project forbids>** — forbidden outright.
3. **<Overriding a governed value at a call site>** — forbidden outright. <Name the props or the
   properties, so crossing it is visible without reading the component.>
