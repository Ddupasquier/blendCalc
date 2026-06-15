<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";

  const tabData = [
    { label: "Ingredients", slug: "/fridge" },
    { label: "Mix", slug: "/mix" },
    { label: "Saved", slug: "/saved" },
  ];

  const isActive = (slug: string) => {
    return $page.url.pathname === slug;
  };

  const selectTab = (slug: string) => {
    goto(slug);
  };
</script>

<nav class="tab-nav" aria-label="Main navigation">
  {#each tabData as tab}
    <button
      class="tab-btn {isActive(tab.slug) ? 'active' : ''}"
      aria-current={isActive(tab.slug) ? "page" : undefined}
      onclick={() => selectTab(tab.slug)}
      type="button"
    >
      {tab.label}
    </button>
  {/each}
</nav>

<style lang="scss">
  @use "../../../styles/variables" as *;
  .tab-nav {
    position: sticky;
    top: 3.05rem;
    z-index: 90;
    display: flex;
    gap: 0.35rem;
    background: $app-bg;
    border-bottom: $app-border;
    box-shadow: $app-card-shadow;
    padding: 0.35rem 0.55rem;
    margin-bottom: $app-gap-md;
    justify-content: center;

    .tab-btn {
      min-width: 0;
      background: none;
      border: none;
      color: $app-primary;
      font-size: $app-font-size-md;
      font-family: $app-button-font-family;
      font-weight: $app-button-font-weight;
      padding: 0.45rem 1.1rem;
      border-radius: $app-radius-pill;
      cursor: pointer;
      line-height: $app-button-line-height;
      transition:
        background 0.13s,
        color 0.13s;

      &.active {
        background: $app-primary;
        color: $app-btn-text;
      }

      &:focus {
        outline: $app-focus-outline;
      }
    }
  }

  @media (max-width: $app-breakpoint-xs) {
    .tab-nav {
      top: 2.85rem;
      gap: 0.25rem;
      padding: 0.3rem 0.45rem;
      margin-bottom: $app-gap-sm;

      .tab-btn {
        flex: 1 1 0;
        padding: 0.45rem 0.4rem;
        font-size: $app-font-size-sm;
      }
    }
  }
</style>
