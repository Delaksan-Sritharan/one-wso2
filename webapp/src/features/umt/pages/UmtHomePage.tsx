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

import { useState } from "react";
import type { ReactNode } from "react";
import {
    Box,
    Button,
    Card,
    CircularProgress,
    Stack,
    Typography,
    useTheme,
} from "@wso2/oxygen-ui";
import { Pause, RefreshCw, Rocket, CheckCircle, Plus } from "@wso2/oxygen-ui-icons-react";
import { teal } from "@mui/material/colors";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useUmtMeta } from "../api/useUmtMeta";
import { lifecycleChartData, releaseChunkChartData, type UmtDashboardDatum } from "../api/umtDashboardStats";
import { useUmtDashboardStats } from "../api/useUmtDashboardStats";
import { useUmtGate } from "../api/useUmtGate";
import UmtCreateUpdateDialog from "../components/UmtCreateUpdateDialog";
import MaintenanceDialog from "../components/MaintenanceDialog";
import UmtShell from "../components/UmtShell";
import { PieChart } from "@wso2/oxygen-ui-charts-react";

type ThemeColor = "primary" | "secondary" | "info" | "success" | "warning" | "error";

// Key colors by status rather than array position so reordering chart data does
// not silently change the meaning of a slice.
const LIFECYCLE_COLORS: Record<string, ThemeColor> = {
    Development: "info",
    Testing: "success",
    Verifying: "warning",
    Pending: "error",
};

const BUILD_COLORS: Record<string, ThemeColor> = {
    Pending: "info",
    Building: "warning",
    Successful: "success",
    Failed: "error",
};

const sumValues = (data: UmtDashboardDatum[]) =>
    data.reduce((total, item) => total + item.value, 0);

const formatPercentage = (value: number, total: number) =>
    total === 0 ? "0.00%" : `${((value / total) * 100).toFixed(2)}%`;

export default function UmtHomePage() {
    return (
        <UmtShell title="Updates Manager Dashboard">
            <UmtDashboardBody />
        </UmtShell>
    );
}

// This component is deliberately below UmtShell. React does not mount it until
// the UMT role gate succeeds, so /meta and /update/stats are never requested for
// a denied user.
function UmtDashboardBody() {
    // Match the source dashboard's eager metadata load. The dialog calls the
    // same subject-scoped query and receives this cached result without a second
    // request.
    useUmtMeta();
    const dashboardStats = useUmtDashboardStats();
    // UmtShell has already resolved this query. Calling the gate here reads the
    // cached role decision needed for the admin-only release-chunk button.
    const gate = useUmtGate();
    const [createUpdateOpen, setCreateUpdateOpen] = useState(false);
    const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);

    const lifecycleData = dashboardStats.data ? lifecycleChartData(dashboardStats.data) : [];
    const releaseChunkData = dashboardStats.data ? releaseChunkChartData(dashboardStats.data) : [];
    const activeUpdates = sumValues(lifecycleData);
    const lifecycleCounts = dashboardStats.data?.updateLifeCycleCounts ?? {};
    return (
        <Stack spacing={3} sx={{ maxWidth: "100%", pb: 4, width: "100%" }}>
            {dashboardStats.isError && (
                <ErrorNotice
                    error={dashboardStats.error}
                    onRetry={() => void dashboardStats.refetch()}
                    retrying={dashboardStats.isFetching}
                >
                    Couldn&apos;t load dashboard statistics.
                </ErrorNotice>
            )}
            <DashboardWidgetHolder
                title="Updates"
                actions={
                    <>
                        <Button
                            variant="outlined"
                            onClick={() => setMaintenanceModalOpen(true)}
                        >
                            View updates
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<Plus size={16} />}
                            onClick={() => setCreateUpdateOpen(true)}
                        >
                            Create
                        </Button>
                    </>
                }
            >
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                        position: "relative",
                    }}
                >
                    <Box
                        sx={{
                            alignItems: "center",
                            display: "flex",
                            justifyContent: "center",
                            p: 2,
                        }}
                    >
                        <DashboardDonut
                            title="Active Updates"
                            legendTitle="Lifecycle States"
                            data={lifecycleData}
                            colorMap={LIFECYCLE_COLORS}
                            loading={dashboardStats.isPending}
                        />
                    </Box>

                    <Box
                        aria-hidden="true"
                        sx={{
                            bgcolor: "divider",
                            bottom: 0,
                            display: { xs: "none", md: "block" },
                            left: "50%",
                            position: "absolute",
                            top: 0,
                            width: "1px",
                        }}
                    />

                    <Box
                        sx={{
                            alignItems: "center",
                            display: "flex",
                            justifyContent: "center",
                            p: 2,
                        }}
                    >
                        <Box
                            sx={{
                                display: "grid",
                                gap: 2,
                                gridTemplateColumns: "repeat(2, minmax(150px, 260px))",
                            }}
                        >
                            <StatCard
                                label="Total"
                                value={dashboardStats.isPending ? <CircularProgress color="inherit" size={22} /> : (dashboardStats.data?.updateCount ?? 0)}
                                icon={<RefreshCw size={32} />}
                                color="warning"
                            />
                            <StatCard
                                label="Active"
                                value={dashboardStats.isPending ? <CircularProgress color="inherit" size={22} /> : activeUpdates}
                                icon={<Rocket size={32} />}
                                color="info"
                            />
                            <StatCard
                                label="On Hold"
                                value={dashboardStats.isPending ? <CircularProgress color="inherit" size={22} /> : (lifecycleCounts.OnHold ?? 0)}
                                icon={<Pause size={32} />}
                                color="secondary"
                                customColor={teal[500]}
                            />
                            <StatCard
                                label="Released"
                                value={dashboardStats.isPending ? <CircularProgress color="inherit" size={22} /> : (lifecycleCounts.Released ?? 0)}
                                icon={<CheckCircle size={32} />}
                                color="success"
                            />
                        </Box>
                    </Box>
                </Box>
            </DashboardWidgetHolder>

            <DashboardWidgetHolder
                title="Release chunks"
                actions={
                    <>
                        <Button
                            variant="outlined"
                            onClick={() => setMaintenanceModalOpen(true)}
                        >
                            View pending
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={() => setMaintenanceModalOpen(true)}
                        >
                            View released
                        </Button>
                        {/* The source route admitted every UMT role by mistake;
                            both this entry and the future route are admin-only. */}
                        {gate.isAdmin && (
                            <Button
                                variant="contained"
                                startIcon={<Plus size={16} />}
                                onClick={() => setMaintenanceModalOpen(true)}
                            >
                                Create
                            </Button>
                        )}
                    </>
                }
            >
                <Box
                    sx={{
                        alignItems: "center",
                        display: "flex",
                        justifyContent: "center",
                        p: 2,
                    }}
                >
                    <DashboardDonut
                        title="Created Chunks"
                        legendTitle="Build Status"
                        data={releaseChunkData}
                        colorMap={BUILD_COLORS}
                        loading={dashboardStats.isPending}
                        total={dashboardStats.data?.createdReleaseChunkBuildCount}
                    />
                </Box>
            </DashboardWidgetHolder>

            <UmtCreateUpdateDialog
                open={createUpdateOpen}
                onClose={() => setCreateUpdateOpen(false)}
            />
            <MaintenanceDialog
                open={maintenanceModalOpen}
                onClose={() => setMaintenanceModalOpen(false)}
            />
        </Stack>
    );
}

// Shared card frame for the two source-dashboard widgets. The body remains a
// slot because Updates is split into chart/stat columns while Release Chunks
// contains one centered chart.
function DashboardWidgetHolder({
                                   title,
                                   actions,
                                   children,
                               }: {
    title: string;
    actions: ReactNode;
    children: ReactNode;
}) {
    return (
        <Card
            variant="outlined"
            sx={{ backgroundColor: "transparent", overflowX: "auto", p: { xs: 2, sm: 3 } }}
        >
            <Box
                sx={{
                    alignItems: { sm: "center" },
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    gap: 1.5,
                    justifyContent: "space-between",
                    mb: 3,
                }}
            >
                <Typography component="h2" variant="h3">
                    {title}
                </Typography>
                <Stack
                    direction="row"
                    spacing={1}
                    sx={{ flexWrap: "wrap", justifyContent: "flex-end" }}
                >
                    {actions}
                </Stack>
            </Box>

            <Box>{children}</Box>
        </Card>
    );
}

// A fixed drawing area keeps both donuts optically equal even though their
// surrounding widget layouts differ.
const CHART_SIZE = 280;

function DashboardDonut({
                            title,
                            legendTitle,
                            data,
                            colorMap,
                            loading,
                            total,
                        }: {
    title: string;
    legendTitle: string;
    data: UmtDashboardDatum[];
    colorMap: Record<string, ThemeColor>;
    loading?: boolean;
    total?: number;
}) {
    const theme = useTheme();
    // Release Chunks supplies the service's authoritative total; Active Updates
    // is the sum of the four lifecycle slices shown in its chart.
    const chartTotal = total ?? sumValues(data);

    if (loading) {
        return (
            <Box sx={{ alignItems: "center", display: "flex", justifyContent: "center", minHeight: CHART_SIZE }}>
                <CircularProgress size={24} />
            </Box>
        );
    }

    if (chartTotal === 0) {
        return (
            <Box
                sx={{
                    alignItems: "center",
                    display: "flex",
                    justifyContent: "center",
                    minHeight: CHART_SIZE,
                }}
            >
                <Typography variant="body2" color="text.secondary">
                    No data yet
                </Typography>
            </Box>
        );
    }

    const colors = data.map((item) => {
        const color = colorMap[item.name] ?? "primary";

        // Prefer CSS-variable values so slice colors update immediately when the
        // active color scheme changes; palette is the fallback for older themes.
        return theme.vars?.palette[color].main ?? theme.palette[color].main;
    });

    // The visual chart and legend are hidden from assistive technology as one
    // accessible image label communicates the same names, values and total once.
    const chartDescription = `${title}: ${data
        .map((item) => `${item.name} ${item.value}`)
        .join(", ")}, total ${chartTotal}`;

    return (
        <Box
            sx={{
                alignItems: "center",
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                justifyContent: "center",
            }}
        >
            <Box
                role="img"
                aria-label={chartDescription}
                sx={{
                    display: "grid",
                    flexShrink: 0,
                    height: CHART_SIZE,
                    width: CHART_SIZE,
                }}
            >
                <Box
                    sx={{
                        "& .recharts-sector": { stroke: "none" },
                        gridArea: "1 / 1",
                        height: "100%",
                        position: "relative",
                        width: "100%",
                        zIndex: 1,
                    }}
                    aria-hidden="true"
                >
                    <PieChart
                        data={data}
                        innerRadius={95}
                        outerRadius={132}
                        pies={[{ dataKey: "value", nameKey: "name" }]}
                        colors={colors}
                        legend={{ show: false }}
                        tooltip={{
                            formatter: (value) => formatPercentage(Number(value), chartTotal),
                        }}
                    />
                </Box>

                <Box
                    aria-hidden="true"
                    sx={{
                        alignItems: "center",
                        display: "flex",
                        flexDirection: "column",
                        gridArea: "1 / 1",
                        justifyContent: "center",
                        position: "relative",
                        textAlign: "center",
                        transform: "translateY(-10px)",
                        zIndex: 0,
                    }}
                >
                    <Typography
                        variant="h1"
                        sx={{
                            fontWeight: 700,
                            lineHeight: 1.1,
                        }}
                    >
                        {chartTotal.toLocaleString()}
                    </Typography>

                    <Typography variant="body1" color="text.secondary">
                        {title}
                    </Typography>
                </Box>
            </Box>

            <Stack
                spacing={1.5}
                sx={{ minWidth: 190 }}
                aria-hidden="true"
            >
                <Typography
                    variant="subtitle1"
                    sx={{
                        fontWeight: 700,
                        mb: 0.5,
                    }}
                >
                    {legendTitle}
                </Typography>

                {data.map((item, index) => (
                    <Box
                        key={item.name}
                        sx={{
                            alignItems: "center",
                            display: "flex",
                            gap: 1.5,
                        }}
                    >
                        <Box
                            sx={{
                                bgcolor: colors[index],
                                borderRadius: 0.75,
                                height: 16,
                                width: 16,
                            }}
                        />

                        <Typography
                            variant="body1"
                            sx={{
                                flex: 1,
                            }}
                        >
                            {item.name}
                        </Typography>

                        <Typography
                            variant="body1"
                            sx={{
                                fontVariantNumeric: "tabular-nums",
                                fontWeight: 700,
                            }}
                        >
                            {item.value}
                        </Typography>
                    </Box>
                ))}
            </Stack>
        </Box>
    );
}

function StatCard({
                      label,
                      value,
                      icon,
                      color,
                      customColor,
                  }: {
    label: string;
    value: number | ReactNode;
    icon: ReactNode;
    color: ThemeColor;
    customColor?: string;
}) {
    const theme = useTheme();
    const cardColor = customColor ?? theme.palette[color].main;

    return (
        <Box
            sx={{
                alignItems: "center",
                border: "2px solid",
                borderColor: cardColor,
                borderRadius: 2,
                color: "text.primary",
                display: "flex",
                justifyContent: "space-between",
                p: 2.5,
            }}
        >
            <Box>
                <Typography
                    variant="body2"
                    sx={{
                        opacity: 0.9,
                    }}
                >
                    {label}
                </Typography>

                <Typography
                    variant="h4"
                    sx={{
                        fontWeight: 700,
                        lineHeight: 1.2,
                    }}
                >
                    {typeof value === "number" ? value.toLocaleString() : value}
                </Typography>
            </Box>

            <Box sx={{ opacity: 0.85 }}>{icon}</Box>
        </Box>
    );
}
