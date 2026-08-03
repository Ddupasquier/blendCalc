import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProductImagePanel from "$lib/components/ingredients/nutrition/ProductImagePanel/ProductImagePanel.svelte";
import type { FdcFood } from "$lib/utils/food/types";

const foodWithImage: FdcFood = {
  fdcId: 1,
  description: "Blue Diamond almond milk",
  foodCategory: "Verified Packaged Food",
  dataType: "Branded",
  foodNutrients: [],
  image: {
    source: "open-food-facts",
    sourceReference: "00000000000000",
    role: "front",
    imageUrl: "https://example.com/almond-milk.jpg",
    licenseName: "Example license",
    licenseUrl: "https://example.com/license",
    attributionText: "Example contributors",
    confidence: "moderator-reviewed",
  },
};

describe("ProductImagePanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps admin and moderator image-placement actions collapsed by default", async () => {
    const { container } = render(ProductImagePanel, {
      props: {
        food: foodWithImage,
        canAdjustImagePlacement: true,
        onImagePlacementSave: vi.fn(),
      },
    });

    const summary = screen
      .getByText("Adjust card image placement")
      .closest("summary");
    const details = summary?.closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(
      summary?.querySelector(".privileged-action-badge"),
    ).toBeInTheDocument();
    await fireEvent.click(screen.getByText("Adjust card image placement"));
    expect(details).toHaveAttribute("open");
    expect(screen.getByText("Card image placement")).toBeInTheDocument();
    expect(screen.getAllByTitle("Privileged action")).toHaveLength(1);
    expect(
      screen
        .getByRole("button", { name: "Save image placement" })
        .querySelector(".privileged-action-badge"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Nutrition page shows the full image."),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".product-image-frame")).toBeInTheDocument();
    expect(screen.getByText("Image: Example contributors")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Example license/ }),
    ).toHaveAttribute("href", "https://example.com/license");
  });

  it("does not show privileged action badges to normal users", () => {
    render(ProductImagePanel, {
      props: {
        food: foodWithImage,
        canAdjustImagePlacement: false,
        onImagePlacementSave: vi.fn(),
      },
    });

    expect(
      screen.queryByText("Adjust card image placement"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTitle("Privileged action")).not.toBeInTheDocument();
  });

  it("applies the saved moderator rotation to the detailed product image", () => {
    const rotatedFood = {
      ...foodWithImage,
      image: {
        ...foodWithImage.image!,
        rotationDegrees: 90 as const,
        placementVersion: 2,
      },
    };
    const { container } = render(ProductImagePanel, {
      props: {
        food: rotatedFood,
        canAdjustImagePlacement: false,
        onImagePlacementSave: vi.fn(),
      },
    });

    expect(
      container.querySelector(
        '.product-image-frame__rotated-image[data-rotation-degrees="90"]',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "Blue Diamond almond milk package image",
      }),
    ).toHaveStyle("--image-placement-viewport-rotation: 90deg");
  });

  it("saves the current placement with one submit activation", async () => {
    const savedImage = {
      ...foodWithImage.image!,
      rotationDegrees: 90 as const,
      fitMode: "custom" as const,
      placementVersion: 2,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ image: savedImage }),
    });
    const onImagePlacementSave = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(ProductImagePanel, {
      props: {
        food: foodWithImage,
        canAdjustImagePlacement: true,
        onImagePlacementSave,
      },
    });

    await fireEvent.click(screen.getByText("Adjust card image placement"));
    await fireEvent.click(
      screen.getByRole("button", { name: "Rotate 90° clockwise" }),
    );
    const saveButton = screen.getByRole("button", {
      name: "Save image placement",
    });
    expect(saveButton).toBeEnabled();

    await fireEvent.click(saveButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(onImagePlacementSave).toHaveBeenCalledOnce();
    });
    expect(
      screen.getByText("Your card image placement is saved."),
    ).toBeInTheDocument();
  });

  it("responds to one save activation when the placement is unchanged", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(ProductImagePanel, {
      props: {
        food: foodWithImage,
        canAdjustImagePlacement: true,
        onImagePlacementSave: vi.fn(),
      },
    });

    await fireEvent.click(screen.getByText("Adjust card image placement"));
    await fireEvent.click(
      screen.getByRole("button", { name: "Save image placement" }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("This card image placement is already saved."),
    ).toBeInTheDocument();
  });
});
