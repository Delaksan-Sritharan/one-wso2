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

import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Card,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import type { JSX } from "react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { isPreviewEnabled } from "@config/previewFeatures";
import { useAccessToken } from "@hooks/useAccessToken";
import {
  getDaily,
  getRepositories,
  getSummary,
  isProductDownloadStatsConfigured,
  productDownloadStatsBackendUrl,
  type DailySeries,
} from "@features/engineering/api/productDownloadStats";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function formatCount(value: number): string {
  return compact.format(value);
}

function productLabel(productName: string | null, repoName: string): string {
  return productName && productName.trim() !== "" ? productName : repoName;
}

export default function EngineeringOverviewPage(): JSX.Element {
  const preview = isPreviewEnabled("engineering");
  const configured = isProductDownloadStatsConfigured();
  const getToken = useAccessToken();
  const base = productDownloadStatsBackendUrl();
  const enabled = preview && configured;

  const summary = useQuery({
    queryKey: ["product-download-stats", "summary", base],
    enabled,
    queryFn: async () => getSummary(await getToken()),
  });
  const daily = useQuery({
    queryKey: ["product-download-stats", "daily", base],
    enabled,
    queryFn: async () => getDaily(await getToken()),
  });
  const repositories = useQuery({
    queryKey: ["product-download-stats", "repositories", base],
    enabled,
    queryFn: async () => getRepositories(await getToken()),
  });

  if (!preview) {
    return <Typography>Engineering isn't available yet.</Typography>;
  }

  if (!configured) {
    return (
      <Typography>
        Product Download Stats isn't connected yet. Set{" "}
        <code>ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL</code> in config.js.
      </Typography>
    );
  }

  const loading = summary.isPending || daily.isPending || repositories.isPending;
  if (loading) {
    return (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mt: 2 }}>
        <CircularProgress size={16} />
        <Typography>Loading release downloads…</Typography>
      </Stack>
    );
  }

  if (summary.isError || daily.isError) {
    const refetch = () => {
      void summary.refetch();
      void daily.refetch();
      void repositories.refetch();
    };
    return (
      <ErrorNotice onRetry={refetch} error={summary.error ?? daily.error}>
        Couldn't load release downloads.
      </ErrorNotice>
    );
  }

  const names = new Map(
    (repositories.data?.repositories ?? []).map((repository) => [
      repository.id,
      productLabel(repository.productName, repository.repoName),
    ]),
  );
  const series = daily.data?.series ?? [];
  const totals = summary.data;

  return (
    <Box>
      <Typography component="h1" variant="h5">
        Overview
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
        Download activity and repository stats across all WSO2 products.
      </Typography>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(5, 1fr)" },
          mb: 2,
        }}
      >
        <Figure
          label="Yesterday's Downloads"
          value={formatCount(totals.todayDownloads)}
          trend={totals.todayDeltaPct}
        />
        <Figure label="This Month's Downloads" value={formatCount(totals.monthDownloads)} />
        <Figure label="Total Downloads" value={formatCount(totals.totalDownloads)} />
        <Figure label="Products Tracked" value={formatCount(totals.trackedRepositories)} />
        <Figure label="Clones (14d)" value={formatCount(totals.totalClonesLast14d)} />
      </Box>

      <Card sx={{ p: 2, mb: 2 }}>
        <Typography component="h2" variant="h6" id="daily-downloads">
          Daily Downloads (last 30 days)
        </Typography>
        {series.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            No data for the selected range
          </Typography>
        ) : (
          <DailyChart series={series} names={names} />
        )}
      </Card>

      <Card sx={{ p: 2 }}>
        <Typography component="h2" variant="h6" sx={{ mb: 1 }}>
          Top Products (Downloads)
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {totals.topProducts.map((product) => (
              <TableRow key={product.repoId}>
                <TableCell>{productLabel(product.productName, product.repoName)}</TableCell>
                <TableCell align="right">{formatCount(product.totalDownloads)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </Box>
  );
}

function Figure({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: number | null;
}): JSX.Element {
  return (
    <Card sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {trend != null && !Number.isNaN(trend) && (
        <Typography sx={{ fontWeight: 700, color: trend >= 0 ? "success.main" : "error.main" }}>
          {Math.abs(trend).toFixed(1)}%
        </Typography>
      )}
      <Typography variant="h4">{value}</Typography>
    </Card>
  );
}

function DailyChart({
  series,
  names,
}: {
  series: DailySeries[];
  names: Map<number, string>;
}): JSX.Element {
  const dates = [...new Set(series.flatMap((item) => item.points.map((point) => point.date)))].sort();
  const data = dates.map((date) => {
    const row: Record<string, string | number> = { date };
    for (const item of series) {
      const point = item.points.find((candidate) => candidate.date === date);
      row[names.get(item.repoId) ?? item.repoName] = point?.value ?? 0;
    }
    return row;
  });
  const keys = series.map((item) => names.get(item.repoId) ?? item.repoName);

  return (
    <Box sx={{ width: "100%", mt: 1 }}>
      <LineChart width={640} height={280} data={data}>
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        {keys.map((key) => (
          <Line key={key} type="monotone" dataKey={key} dot={false} />
        ))}
      </LineChart>
    </Box>
  );
}
