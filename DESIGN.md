# HealthLens — Design System

Documentação da identidade visual, paleta de cores e padrões de uso do design system.

---

## Paleta de Cores

### Background & Surface

| Token SCSS             | Classe Utilitária | Hex       | Uso                          |
| ---------------------- | ----------------- | --------- | ---------------------------- |
| `$color-background`    | `bg-background`   | `#0C0C0E` | Fundo principal da aplicação |
| `$color-surface`       | `bg-surface`      | `#18181B` | Cards, sidebars, modais      |
| `$color-surface-2`     | `bg-surface-2`    | `#1C1C1F` | Camada sobre surface         |
| `$color-border`        | `border`          | `#27272A` | Bordas padrão                |
| `$color-border-strong` | `border-strong`   | `#3F3F46` | Bordas destacadas, hover     |

### Primary (Identidade HealthLens)

| Token SCSS             | Hex                  | Uso                              |
| ---------------------- | -------------------- | -------------------------------- |
| `$color-primary`       | `#FF2D55`            | CTAs, links, estados ativos      |
| `$color-primary-dark`  | `#E0234E`            | Hover de botões primários        |
| `$color-primary-light` | `#FF6482`            | Texto sobre fundo escuro, badges |
| `$color-primary-glow`  | rgba(255,45,85,0.25) | Glow em focus/hover              |

### Semânticas

| Token SCSS       | Classe         | Hex       | Uso                           |
| ---------------- | -------------- | --------- | ----------------------------- |
| `$color-success` | `text-success` | `#30D158` | Valores normais, confirmações |
| `$color-warning` | `text-warning` | `#FF9F0A` | Alertas moderados, atenção    |
| `$color-danger`  | `text-danger`  | `#FF453A` | Erros, valores críticos       |
| `$color-info`    | `text-info`    | `#0A84FF` | Informação, destaque neutro   |

### Texto

| Token SCSS              | Classe           | Hex       | Uso                      |
| ----------------------- | ---------------- | --------- | ------------------------ |
| `$color-text-primary`   | `text-primary`   | `#FAFAFA` | Títulos, texto principal |
| `$color-text-secondary` | `text-secondary` | `#A1A1AA` | Parágrafos, labels       |
| `$color-text-muted`     | `text-muted`     | `#52525B` | Placeholders, metadados  |

---

## Tipografia

### Fontes

| Variável     | Família                        | Uso                                |
| ------------ | ------------------------------ | ---------------------------------- |
| `$font-sans` | Geist Sans → Inter → system-ui | Toda a UI                          |
| `$font-mono` | Geist Mono → Fira Code         | Código, valores numéricos de dados |

### Escala

| Classe      | Tamanho | Uso típico           |
| ----------- | ------- | -------------------- |
| `text-xs`   | 12px    | Badges, metadados    |
| `text-sm`   | 14px    | Labels, helper text  |
| `text-base` | 16px    | Corpo de texto       |
| `text-lg`   | 18px    | Subtítulos           |
| `text-xl`   | 20px    | Títulos de seção     |
| `text-2xl`  | 24px    | Headings secundários |
| `text-3xl`  | 30px    | Headings principais  |

### Pesos

| Classe          | Peso | Uso             |
| --------------- | ---- | --------------- |
| `font-normal`   | 400  | Corpo           |
| `font-medium`   | 500  | Labels, botões  |
| `font-semibold` | 600  | Headings, nomes |
| `font-bold`     | 700  | Destaque máximo |

---

## Badges de Severidade

Usados para classificar insights e alertas de saúde nos dados.

```tsx
<span className="badge-critical">Crítico</span>
<span className="badge-warning">Atenção</span>
<span className="badge-success">Normal</span>
<span className="badge-info">Info</span>
<span className="badge-neutral">Neutro</span>
```

| Classe           | Cor       | Quando usar                                       |
| ---------------- | --------- | ------------------------------------------------- |
| `badge-critical` | `#FF2D55` | Valor fora do intervalo de referência, risco alto |
| `badge-warning`  | `#FF9F0A` | Valor limítrofe, atenção recomendada              |
| `badge-success`  | `#30D158` | Valor dentro do intervalo saudável                |
| `badge-info`     | `#0A84FF` | Informação adicional, sem risco identificado      |
| `badge-neutral`  | `#A1A1AA` | Estado indefinido ou sem classificação            |

---

## Cards

```tsx
// Card estático
<div className="card">Conteúdo</div>

// Card interativo (com hover)
<div className="card-hover">Conteúdo clicável</div>
```

---

## SCSS — Como usar em componentes

```scss
// Em qualquer .module.scss ou .scss
@use '@styles/variables' as *;
@use '@styles/mixins' as *;

.meu-componente {
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-xl;
  padding: $space-6;

  &:hover {
    border-color: $color-primary;
    @include glow($color-primary-glow);
  }
}

.meu-badge {
  @include badge-critical;
}
```

---

## CSS Custom Properties

Todos os tokens também estão disponíveis como CSS vars para uso inline ou em libs externas:

```css
var(--color-background)
var(--color-primary)
var(--color-text-primary)
var(--radius-lg)
```

---

## Dark Mode

Dark mode é o **padrão** da aplicação (`color-scheme: dark` no HTML).
Suporte a light mode futuro: adicionar classe `.light` no `<html>` e sobrescrever as vars em `_theme.scss`.
