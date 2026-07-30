import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import TutorialOverlay from "$lib/components/app/TutorialOverlay/TutorialOverlay.svelte";
import { tutorialSteps } from "$lib/utils/tutorial/steps";

const scrollIntoView = vi.fn();

beforeAll(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
});

beforeEach(() => {
  scrollIntoView.mockClear();
});

const renderTutorial = (onFinish = vi.fn(() => true), onNavigate = vi.fn()) => {
  render(TutorialOverlay, {
    props: {
      open: true,
      pathname: "/ingredients/fridge",
      onNavigate,
      onFinish,
    },
  });

  return { onFinish, onNavigate };
};

const clickReadyButton = async (name: string) => {
  const button = screen.getByRole("button", { name });
  await waitFor(() => expect(button).toBeEnabled());
  await fireEvent.click(button);
};

describe("TutorialOverlay", () => {
	it("moves through concise route-aware tutorial steps", async () => {
		const { onNavigate } = renderTutorial();

    expect(
      screen.getByRole("heading", { name: "Find the foods you use" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Step 1 of ${tutorialSteps.length}`),
    ).toBeInTheDocument();

		await clickReadyButton("Next");
		await screen.findByRole("heading", { name: "Scan packaged foods" });

		await clickReadyButton("Next");
		await screen.findByRole("heading", { name: "Open one ingredient" });

		await clickReadyButton("Next");
		await screen.findByRole("heading", { name: "Manage that ingredient" });

		await clickReadyButton("Next");
		await waitFor(() => {
			expect(onNavigate).toHaveBeenCalledWith("/mix");
		});
    expect(
      screen.getByRole("heading", { name: "Choose what goes into Mix" }),
    ).toBeInTheDocument();
  });

  it("draws a rounded spotlight around the current feature", async () => {
    const viewFrame = document.createElement("main");
    viewFrame.className = "view-frame";
    viewFrame.getBoundingClientRect = () =>
      ({
        top: 20,
        right: 340,
        bottom: 540,
        left: 20,
        width: 320,
        height: 520,
        x: 20,
        y: 20,
        toJSON: () => ({}),
      }) as DOMRect;
    const target = document.createElement("section");
		target.dataset.tutorialTarget = "ingredient-search";
    target.style.borderTopLeftRadius = "12px";
    target.style.borderTopRightRadius = "20px";
    target.style.borderBottomRightRadius = "4px";
    target.style.borderBottomLeftRadius = "0";
    target.getBoundingClientRect = () =>
      ({
        top: 100,
        right: 320,
        bottom: 180,
        left: 40,
        width: 280,
        height: 80,
        x: 40,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
    viewFrame.append(target);
    document.body.append(viewFrame);

    const { container } = render(TutorialOverlay, {
      props: {
        open: true,
        pathname: "/ingredients/fridge",
        onNavigate: vi.fn(),
        onFinish: vi.fn(() => true),
      },
    });

    await waitFor(() => {
      expect(
        container.querySelector(".tutorial-spotlight"),
      ).toBeInTheDocument();
    });
    const spotlight = container.querySelector<HTMLElement>(
      ".tutorial-spotlight",
    );
    expect(spotlight?.style.left).toBe("32px");
    expect(spotlight?.style.width).toBe("296px");
    expect(spotlight?.style.borderRadius).toBe(
      "20px 28px 12px 8px / 20px 28px 12px 8px",
    );
    expect(target).toHaveAttribute("data-tutorial-active", "true");
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "center",
      inline: "nearest",
      behavior: "smooth",
    });
    expect(
      container.querySelector(".tutorial-shade__mask-cutout")?.tagName,
    ).toBe("path");
		expect(
			screen.getByText(
				"The highlighted area contains ingredient search.",
			),
		).toBeInTheDocument();

    viewFrame.remove();
  });

  it("locks scrolling and background interaction until the tour closes", async () => {
    const header = document.createElement("header");
    header.className = "app-header";
    const opener = document.createElement("button");
    opener.type = "button";
    opener.textContent = "Open tutorial";
    header.append(opener);
    const navigation = document.createElement("nav");
    navigation.className = "tab-nav";
    const main = document.createElement("main");
    main.className = "app-main";
    document.body.append(header, navigation, main);
    opener.focus();

    const view = render(TutorialOverlay, {
      props: {
        open: true,
        pathname: "/ingredients/fridge",
        onNavigate: vi.fn(),
        onFinish: vi.fn(() => true),
      },
    });

    await waitFor(() => {
      expect(main).toHaveAttribute("inert");
    });
    expect(header).toHaveAttribute("inert");
    expect(navigation).toHaveAttribute("inert");
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    await waitFor(() => {
      expect(
        screen.getByRole("dialog").contains(document.activeElement),
      ).toBe(true);
    });

    await view.rerender({
      open: false,
      pathname: "/ingredients/fridge",
      onNavigate: vi.fn(),
      onFinish: vi.fn(() => true),
    });

    await waitFor(() => {
      expect(main).not.toHaveAttribute("inert");
    });
    expect(header).not.toHaveAttribute("inert");
    expect(navigation).not.toHaveAttribute("inert");
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.style.overflow).toBe("");
    await waitFor(() => {
      expect(opener).toHaveFocus();
    });

    header.remove();
    navigation.remove();
    main.remove();
  });

  it("finishes after the final step", async () => {
    const onFinish = vi.fn(() => true);
    renderTutorial(onFinish);

    for (let step = 1; step < tutorialSteps.length; step += 1) {
      await clickReadyButton("Next");
    }
    await clickReadyButton("Finish tutorial");
    expect(onFinish).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledWith("complete");
  });

  it("allows the user to postpone the onboarding tour", async () => {
    const onFinish = vi.fn(() => true);
    renderTutorial(onFinish);

    await clickReadyButton("Remind me in 7 days");
    expect(onFinish).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledWith("later");
  });

  it("allows the user to skip without completing every step", async () => {
    const onFinish = vi.fn(() => true);
    renderTutorial(onFinish);

    await clickReadyButton("Don’t show again");
    expect(onFinish).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledWith("complete");
  });

  it("keeps the tutorial open and explains a failed preference save", async () => {
    renderTutorial(vi.fn(() => false));

    await clickReadyButton("Don’t show again");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn’t save that choice. Check your connection and try again.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
