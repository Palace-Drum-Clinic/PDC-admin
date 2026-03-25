import { useEffect, useState } from "react";
import {
  Trash2,
  RefreshCw,
  HardDrive,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Search,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  listAllS3Objects,
  deleteS3Object,
  keyFromUrl,
  formatBytes,
  CLOUDFRONT_URL,
  type S3Object,
} from "@/lib/s3";
import {
  Button,
  Badge,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Alert,
} from "@/components/ui";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface S3Item extends S3Object {
  linkedToDb: boolean;
  dbTitle?: string;
  selected: boolean;
}

type ViewFilter = "all" | "orphans" | "linked";

// ─── Component ─────────────────────────────────────────────────────────────────

export function S3CleanupPage() {
  const [items, setItems] = useState<S3Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<ViewFilter>("orphans");
  const [search, setSearch] = useState("");
  const [lastScanned, setLastScanned] = useState<Date | null>(null);

  async function scan() {
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      // Fetch S3 objects, Video URLs, and Artist image URLs in parallel
      const [s3Objects, videoResult, artistResult] = await Promise.all([
        listAllS3Objects(),
        supabase.from("Video").select("id, title, videoURL, thumbnailURL, pdfURL"),
        supabase.from("Artist").select("id, name, profileImageURL"),
      ]);

      if (videoResult.error) throw videoResult.error;
      if (artistResult.error) throw artistResult.error;

      // Build a set of all known S3 keys from the DB
      const knownKeys = new Set<string>();
      const keyToTitle = new Map<string, string>();

      for (const row of videoResult.data ?? []) {
        const r = row as {
          id: string;
          title: string;
          videoURL: string | null;
          thumbnailURL: string | null;
          pdfURL: string | null;
        };
        for (const url of [r.videoURL, r.thumbnailURL, r.pdfURL]) {
          if (!url) continue;
          const key = keyFromUrl(url);
          if (key) {
            knownKeys.add(key);
            keyToTitle.set(key, r.title);
          }
        }
      }

      for (const row of artistResult.data ?? []) {
        const r = row as { id: string; name: string; profileImageURL: string | null };
        if (!r.profileImageURL) continue;
        const key = keyFromUrl(r.profileImageURL);
        if (key) {
          knownKeys.add(key);
          keyToTitle.set(key, r.name);
        }
      }

      // Filter out S3 folder placeholder objects (keys ending in "/" or zero-byte directory markers)
      const files = s3Objects.filter((obj) => !obj.key.endsWith("/") && obj.size > 0);

      const mapped: S3Item[] = files.map((obj) => ({
        ...obj,
        linkedToDb: knownKeys.has(obj.key),
        dbTitle: keyToTitle.get(obj.key),
        selected: false,
      }));

      setItems(mapped);
      setLastScanned(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    scan();
  }, []);

  // ── Selection ──────────────────────────────────────────────────────────────

  function toggleSelect(key: string) {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, selected: !i.selected } : i))
    );
  }

  function selectAllVisible() {
    const visibleKeys = new Set(filteredItems.map((i) => i.key));
    setItems((prev) =>
      prev.map((i) =>
        visibleKeys.has(i.key) ? { ...i, selected: true } : i
      )
    );
  }

  function clearSelection() {
    setItems((prev) => prev.map((i) => ({ ...i, selected: false })));
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function deleteSelected() {
    const toDelete = items.filter((i) => i.selected);
    if (!toDelete.length) return;
    if (
      !confirm(
        `Permanently delete ${toDelete.length} file${toDelete.length > 1 ? "s" : ""} from S3? This cannot be undone.`
      )
    )
      return;

    setIsDeleting(true);
    setError(null);
    let deleted = 0;

    for (const item of toDelete) {
      try {
        await deleteS3Object(item.key);
        deleted++;
        setItems((prev) => prev.filter((i) => i.key !== item.key));
      } catch (err) {
        setError(
          `Failed to delete ${item.key}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }

    setIsDeleting(false);
    if (deleted > 0) {
      setSuccessMsg(`Deleted ${deleted} file${deleted > 1 ? "s" : ""}.`);
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const orphans = items.filter((i) => !i.linkedToDb);
  const linked = items.filter((i) => i.linkedToDb);
  const selectedCount = items.filter((i) => i.selected).length;
  const orphanSize = orphans.reduce((sum, i) => sum + i.size, 0);
  const totalSize = items.reduce((sum, i) => sum + i.size, 0);

  const filteredItems = items
    .filter((i) => {
      if (filter === "orphans") return !i.linkedToDb;
      if (filter === "linked") return i.linkedToDb;
      return true;
    })
    .filter((i) =>
      search ? i.key.toLowerCase().includes(search.toLowerCase()) : true
    );

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <HardDrive className="h-8 w-8" />
            S3 Storage Cleanup
          </h1>
          <p className="text-muted-foreground mt-1">
            Find and remove files in S3 that aren't linked to any video in the
            database.
          </p>
        </div>
        <Button onClick={scan} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {isLoading ? "Scanning…" : "Scan"}
        </Button>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          {successMsg}
        </div>
      )}

      {/* Stats */}
      {lastScanned && !isLoading && (
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="Total files"
            value={items.length}
            sub={formatBytes(totalSize)}
          />
          <StatCard
            label="Linked to DB"
            value={linked.length}
            sub={`${formatBytes(linked.reduce((s, i) => s + i.size, 0))}`}
            color="green"
          />
          <StatCard
            label="Orphaned"
            value={orphans.length}
            sub={formatBytes(orphanSize)}
            color={orphans.length > 0 ? "amber" : "green"}
          />
          <StatCard
            label="Selected"
            value={selectedCount}
            sub={
              selectedCount > 0
                ? formatBytes(
                    items
                      .filter((i) => i.selected)
                      .reduce((s, i) => s + i.size, 0)
                  )
                : "none"
            }
          />
        </div>
      )}

      {/* Controls */}
      {!isLoading && items.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {/* Filter tabs */}
          <div className="flex rounded-lg border overflow-hidden">
            {(["orphans", "linked", "all"] as ViewFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm capitalize transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                {f}
                <span className="ml-1.5 text-xs opacity-70">
                  {f === "orphans"
                    ? orphans.length
                    : f === "linked"
                    ? linked.length
                    : items.length}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by path…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={selectAllVisible}>
              Select all
            </Button>
            {selectedCount > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={deleteSelected}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete {selectedCount}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* File table */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>Scanning S3 bucket and cross-referencing database…</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8" />
              <p>
                {filter === "orphans"
                  ? "No orphaned files found — bucket is clean!"
                  : "No files match this filter."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {filteredItems.length} file{filteredItems.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {filteredItems.map((item) => (
                <FileRow
                  key={item.key}
                  item={item}
                  onToggle={() => toggleSelect(item.key)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {lastScanned && !isLoading && (
        <p className="text-xs text-muted-foreground text-right">
          Last scanned: {lastScanned.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

// ─── FileRow ───────────────────────────────────────────────────────────────────

function FileRow({
  item,
  onToggle,
}: {
  item: S3Item;
  onToggle: () => void;
}) {
  const isImage =
    item.key.match(/\.(jpg|jpeg|png|webp|gif)$/i) !== null;
  const isOrphan = !item.linkedToDb;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/50 ${
        item.selected ? "bg-primary/5" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={item.selected}
        onChange={onToggle}
        className="h-4 w-4 rounded border-input"
      />

      {/* Thumbnail preview for images */}
      {isImage ? (
        <img
          src={`${CLOUDFRONT_URL}/${item.key}`}
          alt=""
          className="h-10 w-16 rounded object-cover flex-shrink-0 bg-muted"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div className="h-10 w-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
          <span className="text-xs text-muted-foreground uppercase">
            {item.key.split(".").pop()}
          </span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono truncate">{item.key}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {formatBytes(item.size)}
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            {item.lastModified.toLocaleDateString()}
          </span>
          {item.dbTitle && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground truncate">
                {item.dbTitle}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {isOrphan ? (
          <Badge
            variant="secondary"
            className="bg-amber-100 text-amber-800 text-xs"
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Orphan
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
            Linked
          </Badge>
        )}
        <a
          href={`${CLOUDFRONT_URL}/${item.key}`}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground"
          title="Open in new tab"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

// ─── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number;
  sub: string;
  color?: "green" | "amber";
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={`text-2xl font-bold ${
            color === "green"
              ? "text-green-600"
              : color === "amber"
              ? "text-amber-600"
              : ""
          }`}
        >
          {value.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
