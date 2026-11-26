// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { useState, type Dispatch, type FormEvent, type JSX, type SetStateAction } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { ArrowLeftIcon } from "@wso2/oxygen-ui-icons-react";
import { HttpError } from "@api/http";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import { visuallyHidden } from "@utils/visuallyHidden";
import type { SwagStoreAdminProduct, SwagStoreAdminVariant, SwagStoreProductStatus } from "../../api/swagStoreTypes";
import TintedChip from "../../components/TintedChip";
import { formatCivilDate, formatInstant } from "../../util/civilDate";
import { formatCoins } from "../../util/coins";
import {
  checkProductForm,
  EMPTY_PRODUCT_FORM,
  productFormOf,
  productInputOf,
  type ProductForm,
  type ProductFormErrors,
} from "../../util/productForm";
import { messageFor } from "../../util/swagStoreError";
import { useAdminCategories, useAdminProduct, useAdminProducts } from "../api/useAdminData";
import { useCreateProduct, useDeleteDraft, useSetProductStatus, useUpdateProduct } from "../api/useAdminMutations";
import OptionsEditor from "../components/OptionsEditor";
import PhotosField from "../components/PhotosField";
import RemoveProductDialog from "../components/RemoveProductDialog";
import StockDialog from "../components/StockDialog";
import VariantEditDialog from "../components/VariantEditDialog";
import { swagStoreAdminPaths } from "../swagStoreAdminItems";

const STATUS_CHIP: Record<SwagStoreProductStatus, { label: string; color: "default" | "success" | "warning" }> = {
  DRAFT: { label: "Draft", color: "warning" },
  ACTIVE: { label: "Active", color: "success" },
  REMOVED: { label: "Removed", color: "default" },
};

/** `/people-ops/swag-store/products/new` and `/products/:productId`: one product's basics, status, options, variants and stock. */
export default function ProductEditorPage(): JSX.Element {
  const { productId = "" } = useParams();
  const isNew = productId === "";
  const product = useAdminProduct(productId);
  useDocumentTitle(isNew ? "New product · Swag Store" : product.data ? `${product.data.name} · Swag Store` : "Product · Swag Store");

  let body: JSX.Element;
  if (isNew) body = <Editor key="new" product={undefined} />;
  else if (product.isPending) body = <Skeleton variant="rounded" height={420} aria-label="Loading the product" />;
  else if (product.isError) {
    body =
      product.error instanceof HttpError && product.error.status === 404 ? (
        <Typography>That product doesn&apos;t exist.</Typography>
      ) : (
        <ErrorNotice onRetry={() => void product.refetch()} retrying={product.isFetching} error={product.error}>
          Couldn&apos;t load this product.
        </ErrorNotice>
      );
  } else body = <Editor key={product.data.id} product={product.data} />;

  return (
    <Box>
      <Button component={RouterLink} to={swagStoreAdminPaths.products} size="small" startIcon={<ArrowLeftIcon size={16} />} sx={{ mb: 1, ml: -1 }}>
        Products
      </Button>
      {body}
    </Box>
  );
}

function Editor({ product }: { product: SwagStoreAdminProduct | undefined }): JSX.Element {
  const [stockSaved, setStockSaved] = useState<string>();
  // Here, not in OptionsEditor: new options remount it, and the notice must outlive that.
  const [optionsSaved, setOptionsSaved] = useState(false);
  // Here, not in BasicsForm, so the header can tell when the basics differ from the saved product.
  const [form, setForm] = useState<ProductForm>(() => (product ? productFormOf(product) : EMPTY_PRODUCT_FORM));
  const basicsUnsaved =
    product !== undefined && JSON.stringify(productInputOf(form)) !== JSON.stringify(productInputOf(productFormOf(product)));
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Header product={product} basicsUnsaved={basicsUnsaved} />
      <BasicsForm product={product} form={form} setForm={setForm} />
      {product ? (
        <>
          <Divider />
          {/* Keyed by the saved options, so the editor restarts from what the backend kept. */}
          <OptionsEditor
            key={JSON.stringify(product.options)}
            product={product}
            onSaved={() => setOptionsSaved(true)}
            onEdit={() => setOptionsSaved(false)}
          />
          {optionsSaved && (
            <Alert severity="success" role="status" onClose={() => setOptionsSaved(false)}>
              Options saved. The variants below match them.
            </Alert>
          )}
          <Divider />
          {stockSaved && (
            <Alert severity="success" role="status" onClose={() => setStockSaved(undefined)}>
              {stockSaved}
            </Alert>
          )}
          <VariantTable product={product} onStockSaved={setStockSaved} />
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Create the draft first. Then you can add options, variants and stock, and publish it.
        </Typography>
      )}
    </Box>
  );
}

interface HeaderProps {
  readonly product: SwagStoreAdminProduct | undefined;
  /** Publish and Restore act on the saved product, so they wait while the basics have unsaved changes. */
  readonly basicsUnsaved: boolean;
}

function Header({ product, basicsUnsaved }: HeaderProps): JSX.Element {
  const navigate = useNavigate();
  const setStatus = useSetProductStatus(product?.id ?? "");
  const deleteDraft = useDeleteDraft(product?.id ?? "");
  const [removing, setRemoving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {/* The title on the left, the actions at the top right (below it on narrow screens). */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", minWidth: 0 }}>
          <Typography component="h1" variant="h5" sx={{ m: 0 }}>
            {product ? product.name : "New product"}
          </Typography>
          {product && <TintedChip color={STATUS_CHIP[product.status].color} label={STATUS_CHIP[product.status].label} />}
        </Box>
        {product && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1, flexWrap: "wrap", ml: "auto" }}>
            {product.status !== "ACTIVE" && (
              <Button
                variant="contained"
                disabled={setStatus.isPending || basicsUnsaved}
                onClick={() => setStatus.mutate({ status: "ACTIVE" })}
              >
                {setStatus.isPending ? "Saving…" : product.status === "DRAFT" ? "Publish" : "Restore"}
              </Button>
            )}
            {product.status !== "ACTIVE" && basicsUnsaved && (
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                Save the basics first.
              </Typography>
            )}
            {product.status === "ACTIVE" && (
              <Button variant="outlined" color="error" onClick={() => setRemoving(true)}>
                Remove from store
              </Button>
            )}
            {product.status === "DRAFT" && !confirmDelete && (
              <Button color="error" onClick={() => setConfirmDelete(true)}>
                Delete draft
              </Button>
            )}
            {product.status === "DRAFT" && confirmDelete && (
              <>
                <Typography variant="body2" sx={{ alignSelf: "center" }}>
                  Delete this draft for good?
                </Typography>
                <Button
                  color="error"
                  variant="contained"
                  disabled={deleteDraft.isPending}
                  onClick={() => deleteDraft.mutate(undefined, { onSuccess: () => navigate(swagStoreAdminPaths.productsTab("draft")) })}
                >
                  {deleteDraft.isPending ? "Deleting…" : "Yes, delete"}
                </Button>
                <Button onClick={() => setConfirmDelete(false)} disabled={deleteDraft.isPending}>
                  Cancel
                </Button>
              </>
            )}
          </Box>
        )}
      </Box>
      {product?.status === "REMOVED" && (
        <Alert severity="info">
          Removed{product.removedAt ? ` ${formatInstant(product.removedAt)}` : ""}.{product.removalNote ? ` ${product.removalNote}` : ""} Orders
          placed before that are still being served.
        </Alert>
      )}
      {setStatus.isError && <Alert severity="error">{messageFor(setStatus.error)}</Alert>}
      {deleteDraft.isError && <Alert severity="error">{messageFor(deleteDraft.error)}</Alert>}
      {removing && product && <RemoveProductDialog product={product} onClose={() => setRemoving(false)} />}
    </Box>
  );
}

interface BasicsFormProps {
  readonly product: SwagStoreAdminProduct | undefined;
  readonly form: ProductForm;
  readonly setForm: Dispatch<SetStateAction<ProductForm>>;
}

function BasicsForm({ product, form, setForm }: BasicsFormProps): JSX.Element {
  const navigate = useNavigate();
  const categories = useAdminCategories();
  const actives = useAdminProducts("ACTIVE");
  const create = useCreateProduct();
  const update = useUpdateProduct(product?.id ?? "");
  const save = product ? update : create;
  // Plain state, not react-hook-form, like the store's other admin forms (offices,
  // options, variants, stock). The checks are pure functions in util/productForm.ts
  // that the tests call directly, and the form is one object the header compares
  // with the saved product. A library would wrap those checks, not replace them.
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const errors = checkProductForm(form);
  const shown = (field: keyof ProductFormErrors) => (touched.has(field) ? errors[field] : undefined);
  // Photos still being scaled or uploaded aren't in the form yet; saving now would leave them out.
  const [photosBusy, setPhotosBusy] = useState<ReadonlySet<string>>(new Set());
  const waitingForPhotos = photosBusy.size > 0;
  // What the last save left in the form, so "Saved." goes once anything changes.
  const [savedInput, setSavedInput] = useState<string | null>(null);
  const currentInput = JSON.stringify(productInputOf(form));
  const canSave = Object.keys(errors).length === 0 && !save.isPending && !waitingForPhotos;

  const set = <K extends keyof ProductForm>(field: K, value: ProductForm[K]) => {
    setForm((f) => ({ ...f, [field]: value }));
    setTouched((t) => new Set(t).add(field));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    const input = productInputOf(form);
    const sent = JSON.stringify(input);
    if (product) {
      update.mutate(input, {
        onSuccess: (saved) => {
          // The store fills in what was left empty (the slug), so start again from what it kept,
          // unless the form changed while saving (a photo that finished uploading, say).
          const next = productFormOf(saved);
          setForm((f) => (JSON.stringify(productInputOf(f)) === sent ? next : f));
          setSavedInput(JSON.stringify(productInputOf(next)));
        },
      });
    } else create.mutate(input, { onSuccess: (saved) => navigate(swagStoreAdminPaths.product(saved.id), { replace: true }) });
  };

  // The first page of active products (50). The catalog is a few dozen items, so that is all of them.
  // A saved alternative that isn't on it (a draft, or removed since) shows as "Not on sale" so it can be cleared.
  const alternatives = (actives.data?.items ?? []).filter((p) => p.id !== product?.id);
  const offSale = form.alternatives.filter((id) => !alternatives.some((p) => p.id === id));
  const alternativeName = (id: string) => alternatives.find((p) => p.id === id)?.name ?? "Not on sale";

  return (
    <Card variant="outlined" component="form" onSubmit={submit} noValidate sx={{ p: 2, borderRadius: 1.5, display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography component="h2" variant="h6">
        Basics
      </Typography>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        <TextField label="Name" size="small" required value={form.name} onChange={(e) => set("name", e.target.value)} error={Boolean(shown("name"))} helperText={shown("name")} />
        <TextField
          label="Slug"
          size="small"
          value={form.slug}
          onChange={(e) => set("slug", e.target.value)}
          error={Boolean(shown("slug"))}
          helperText={shown("slug") ?? "Part of the product's link. Leave empty to make one from the name."}
        />
        <TextField
          label="Price (O2C)"
          size="small"
          required
          value={form.price}
          onChange={(e) => set("price", e.target.value)}
          error={Boolean(shown("price"))}
          helperText={shown("price")}
          slotProps={{ htmlInput: { inputMode: "numeric" } }}
        />
        <TextField
          label="Max per person"
          size="small"
          value={form.maxPerUser}
          onChange={(e) => set("maxPerUser", e.target.value)}
          error={Boolean(shown("maxPerUser"))}
          helperText={shown("maxPerUser") ?? "Empty for no limit."}
          slotProps={{ htmlInput: { inputMode: "numeric" } }}
        />
        <FormControl size="small">
          <InputLabel id="swag-store-product-category">Category</InputLabel>
          <Select labelId="swag-store-product-category" label="Category" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            <MenuItem value="">None</MenuItem>
            {(categories.data ?? []).map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel id="swag-store-product-restock">When it runs out</InputLabel>
          <Select
            labelId="swag-store-product-restock"
            label="When it runs out"
            value={form.restockPolicy}
            onChange={(e) => set("restockPolicy", e.target.value as ProductForm["restockPolicy"])}
          >
            <MenuItem value="RESTOCKABLE">Restocked (out of stock, Notify me)</MenuItem>
            <MenuItem value="LIMITED">Limited batch (sold out for good)</MenuItem>
          </Select>
        </FormControl>
      </Box>
      <TextField
        label="Description"
        size="small"
        multiline
        minRows={3}
        value={form.description}
        onChange={(e) => set("description", e.target.value)}
        error={Boolean(shown("description"))}
        helperText={shown("description") ?? "Plain text."}
        slotProps={{ htmlInput: { maxLength: 2000 } }}
      />
      <PhotosField
        productId={product?.id}
        productName={form.name.trim() || "This product"}
        images={form.images}
        onChange={(update) => setForm((f) => ({ ...f, images: update(f.images) }))}
        onBusyChange={(view, busy) =>
          setPhotosBusy((s) => {
            const next = new Set(s);
            if (busy) next.add(view);
            else next.delete(view);
            return next;
          })
        }
      />
      <FormControl size="small">
        <InputLabel id="swag-store-product-alternatives">Alternatives</InputLabel>
        <Select
          labelId="swag-store-product-alternatives"
          label="Alternatives"
          multiple
          value={[...form.alternatives]}
          onChange={(e) => set("alternatives", typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value)}
          renderValue={(ids) => ids.map(alternativeName).join(", ")}
        >
          {alternatives.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name}
            </MenuItem>
          ))}
          {offSale.map((id) => (
            <MenuItem key={id} value={id}>
              Not on sale
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {save.isError && <Alert severity="error">{messageFor(save.error)}</Alert>}
      {update.isSuccess && product && savedInput === currentInput && (
        <Alert severity="success" role="status">
          Saved.
        </Alert>
      )}
      <Box>
        <Button type="submit" variant="contained" disabled={!canSave} startIcon={save.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}>
          {save.isPending ? "Saving…" : waitingForPhotos ? "Waiting for photos…" : product ? "Save changes" : "Create draft"}
        </Button>
      </Box>
    </Card>
  );
}

function VariantTable({ product, onStockSaved }: { product: SwagStoreAdminProduct; onStockSaved: (message: string) => void }): JSX.Element {
  const [editing, setEditing] = useState<SwagStoreAdminVariant>();
  const [stocking, setStocking] = useState<SwagStoreAdminVariant>();
  return (
    <Box component="section" aria-labelledby="swag-store-variants-title">
      <Typography id="swag-store-variants-title" component="h2" variant="h6" sx={{ mb: 1.5 }}>
        Variants and stock
      </Typography>
      {product.variants.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No variants yet. Save the options to make them.
        </Typography>
      ) : (
        <Card variant="outlined" sx={{ borderRadius: 1.5, overflowX: "auto" }}>
          <Table size="small" aria-label="Variants">
            <TableHead>
              <TableRow>
                <TableCell>SKU</TableCell>
                <TableCell>Options</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="right">On hand</TableCell>
                <TableCell align="right">Reserved</TableCell>
                <TableCell align="right">Free</TableCell>
                <TableCell>Restock</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">
                  <Box component="span" sx={visuallyHidden}>
                    Actions
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {product.variants.map((v) => (
                <TableRow key={v.id}>
                  <TableCell sx={{ fontFamily: "monospace" }}>{v.sku}</TableCell>
                  <TableCell>{v.options || "—"}</TableCell>
                  <TableCell align="right">{formatCoins(product.price + v.priceDelta)}</TableCell>
                  <TableCell align="right">{v.onHand}</TableCell>
                  <TableCell align="right">{v.reserved}</TableCell>
                  <TableCell align="right">{v.free}</TableCell>
                  <TableCell>{v.restockEta ? (formatCivilDate(v.restockEta) ?? v.restockEta) : "—"}</TableCell>
                  <TableCell>
                    <TintedChip color={v.active ? "success" : "default"} label={v.active ? "Sold" : "Hidden"} />
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Button size="small" onClick={() => setEditing(v)} aria-label={`Edit ${v.sku}`}>
                      Edit
                    </Button>
                    <Button size="small" onClick={() => setStocking(v)} aria-label={`Stock for ${v.sku}`}>
                      Stock
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {editing && <VariantEditDialog productId={product.id} basePrice={product.price} variant={editing} onClose={() => setEditing(undefined)} />}
      {stocking && (
        <StockDialog
          variant={stocking}
          onClose={() => setStocking(undefined)}
          onSaved={(r) =>
            onStockSaved(
              r.notified > 0
                ? `Stock saved. ${r.notified} ${r.notified === 1 ? "person" : "people"} waiting for it ${r.notified === 1 ? "was" : "were"} emailed.`
                : "Stock saved.",
            )
          }
        />
      )}
    </Box>
  );
}
