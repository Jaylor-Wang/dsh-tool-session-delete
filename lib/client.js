/**
 * Permanent session deletion, browser half.
 *
 * Adds one row to the left sidebar's per-session "…" menu and answers it with a
 * `shell.overlay` confirmation dialog. The dialog lives outside the menu because
 * the row unmounts with it; the menu row only raises the request.
 *
 * This file is served raw as a classic script and registers a factory; every
 * side effect, including `React.createElement` work, belongs inside it.
 */
window.__ModuleLoader__.load({
	id: "dsh-tool-session-delete",
	factory(require) {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		var react = require("react");
		var react_jsx_runtime = require("react/jsx-runtime");

		/** Dictionary namespace owned by this plugin. */
		const NS = "sessionDelete";

		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"menu.delete": "删除会话",
			"dialog.title": "永久删除会话？",
			"dialog.desc": "将永久删除“{title}”的会话记录及其派生数据。此操作无法撤销，也不会放入回收站。",
			"dialog.loading": "正在读取会话信息…",
			"dialog.live": "该会话当前仍在本机打开中；删除后无法再打开或恢复。",
			"dialog.stop": "正在运行的工作会先被停止，与该会话绑定的提醒也会一并删除。",
			"dialog.reminders": "将一并删除 {n} 个提醒。",
			"dialog.size": "会话日志约 {size}。",
			"activity.aria": "将被一并删除的内容",
			"activity.turn.one": "{n} 个进行中的轮次",
			"activity.turn.other": "{n} 个进行中的轮次",
			"activity.subagent.one": "{names}",
			"activity.subagent.other": "{names}",
			"activity.job.one": "{names}",
			"activity.job.other": "{names}",
			"activity.schedule.one": "{names}",
			"activity.schedule.other": "{names}",
			"activity.other": "{n} 项其他活动",
			"close": "关闭",
			"cancel": "取消",
			"confirm": "永久删除",
			"pending": "正在删除…",
			"failed": "删除失败"
		};

		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"menu.delete": "Delete session",
			"dialog.title": "Permanently delete this session?",
			"dialog.desc": "“{title}” and its derived data are removed for good. This cannot be undone and nothing goes to a trash folder.",
			"dialog.loading": "Reading session details…",
			"dialog.live": "This session is still open on this machine. It cannot be reopened or restored afterwards.",
			"dialog.stop": "Any running work is stopped first, and reminders bound to the session are deleted with it.",
			"dialog.reminders": "{n} reminder will be deleted with it.",
			"dialog.size": "The session log is about {size}.",
			"activity.aria": "What else this removes",
			"activity.turn.one": "{n} turn in progress",
			"activity.turn.other": "{n} turns in progress",
			"activity.subagent.one": "{names}",
			"activity.subagent.other": "{names}",
			"activity.job.one": "{names}",
			"activity.job.other": "{names}",
			"activity.schedule.one": "{names}",
			"activity.schedule.other": "{names}",
			"activity.other": "{n} other activity",
			"close": "Close",
			"cancel": "Cancel",
			"confirm": "Delete permanently",
			"pending": "Deleting…",
			"failed": "Deletion failed"
		};

		/**
		 * One tiny observable store: the slot hook face wants a
		 * `{getSnapshot, subscribe}` pair, and nothing else here needs a store
		 * library.
		 *
		 * @param {*} initial - Starting snapshot.
		 * @returns {{getSnapshot: Function, subscribe: Function, set: Function}} the store.
		 */
		function createStore(initial) {
			let value = initial;
			const listeners = new Set();
			return {
				getSnapshot: () => value,
				subscribe(listener) {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				set(next) {
					value = next;
					for (const listener of [...listeners]) listener();
				}
			};
		}

		/**
		 * Call one `sessionDelete` host method over the ordinary API RPC
		 * channel and unwrap its result envelope.
		 *
		 * @param {object} ctx - Client context carrying the Connection.
		 * @param {string} method - Host method name.
		 * @param {object} request - Wire request body.
		 * @returns {Promise<*>} the decoded host result.
		 */
		async function callHost(ctx, method, request) {
			const result = await ctx.connection.rpc.call("/api", `sessionDelete/${method}`, { args: { request } });
			if (!result.ok) {
				const failure = new Error(result.error?.message ?? `the host refused sessionDelete/${method}`);
				failure.code = result.error?.code;
				throw failure;
			}
			return result.value;
		}

		/**
		 * Render a byte count the way the rest of the shell does.
		 *
		 * @param {number} bytes - Log size in bytes.
		 * @returns {string} a short human-readable size.
		 */
		function formatSize(bytes) {
			if (bytes < 1024) return `${bytes} B`;
			const units = ["KB", "MB", "GB"];
			let value = bytes / 1024;
			let unit = 0;
			while (value >= 1024 && unit < units.length - 1) {
				value /= 1024;
				unit += 1;
			}
			return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
		}

		/**
		 * The row's own request: the identity the owner already handed us,
		 * carried to the dialog that outlives this row.
		 *
		 * @param {object} props - Slot owner props plus the dialog share.
		 * @returns {object} the menu row.
		 */
		function DeleteSessionMenuItem(props) {
			const { sessionId, displayTitle, useMenuOpenState, requestSessionDelete, t } = props;
			const [, setMenuOpen] = useMenuOpenState();
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MenuItemButton, {
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 }),
				danger: true,
				separatorBefore: true,
				onSelect: () => {
					setMenuOpen(false);
					requestSessionDelete({ sessionId, displayTitle });
				},
				children: t("menu.delete")
			});
		}

		/**
		 * One activity family as one line, with unknown kinds falling through to
		 * a generic count.
		 *
		 * @param {{kind: string, items: {label: string | null}[]}} entry - Registry activity.
		 * @param {Function} t - Dictionary translator.
		 * @returns {string} the rendered line.
		 */
		function activityLine(entry, t) {
			const n = entry.items.length;
			const names = entry.items.map((item) => item.label ?? item.id).join(", ");
			const plural = n === 1 ? "one" : "other";
			if (entry.kind !== "turn" && entry.kind !== "subagent" && entry.kind !== "job" && entry.kind !== "schedule") {
				return t("activity.other", { n });
			}
			if (entry.kind === "turn") return t(`activity.turn.${plural}`, { n, names });
			return t(`activity.${entry.kind}.${plural}`, { n, names });
		}

		/**
		 * The confirmation dialog. It is mounted per request, so its in-flight
		 * and error state die with the request that raised them.
		 *
		 * @param {object} props - The request, the describe/delete shares, and the locale.
		 * @returns {object} the form.
		 */
		function DeleteSessionForm(props) {
			const { request, describeSession, deleteSession, onSettle, t } = props;
			const [details, setDetails] = react.useState(null);
			const [loadError, setLoadError] = react.useState(null);
			const [deleting, setDeleting] = react.useState(false);
			const [error, setError] = react.useState(null);
			react.useEffect(() => {
				let live = true;
				describeSession(request.sessionId).then((described) => {
					if (live) setDetails(described);
				}).catch((reason) => {
					if (live) setLoadError(reason instanceof Error ? reason.message : String(reason));
				});
				return () => {
					live = false;
				};
			}, [request.sessionId]);
			const close = () => {
				if (!deleting) onSettle();
			};
			const confirm = () => {
				if (deleting) return;
				setDeleting(true);
				setError(null);
				deleteSession(request.sessionId).then(() => {
					onSettle();
				}).catch((reason) => {
					setDeleting(false);
					setError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const active = (details?.activity ?? []).filter((entry) => entry.items.length > 0);
			const reminders = active
				.filter((entry) => entry.kind === "schedule")
				.reduce((sum, entry) => sum + entry.items.length, 0);
			const notes = [];
			if (details?.live) notes.push(t("dialog.live"));
			notes.push(t("dialog.stop"));
			if (reminders > 0) notes.push(t("dialog.reminders", { n: reminders }));
			return (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				onClose: close,
				closeLabel: t("close"),
				title: t("dialog.title"),
				description: t("dialog.desc", { title: request.displayTitle }),
				footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
					children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						disabled: deleting,
						onClick: close,
						children: t("cancel")
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						disabled: deleting,
						onClick: confirm,
						children: deleting ? t("pending") : t("confirm")
					})]
				}),
				children: [
					(0, react_jsx_runtime.jsxs)("ul", {
						"aria-label": t("activity.aria"),
						children: [...notes.map((note, index) => (0, react_jsx_runtime.jsx)("li", { children: note }, `note-${String(index)}`)), ...active.map((entry, index) => (0, react_jsx_runtime.jsx)("li", { children: activityLine(entry, t) }, `activity-${entry.kind}-${String(index)}`))]
					}),
					details === null && loadError === null && (0, react_jsx_runtime.jsx)("div", {
						role: "status",
						children: t("dialog.loading")
					}),
					details?.sizeBytes !== null && details?.sizeBytes !== void 0 && (0, react_jsx_runtime.jsx)("div", { children: t("dialog.size", {
						size: formatSize(details.sizeBytes)
					}) }),
					deleting && (0, react_jsx_runtime.jsx)("div", {
						role: "status",
						children: t("pending")
					}),
					(error ?? loadError) !== null && (0, react_jsx_runtime.jsx)("div", {
						role: "alert",
						children: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
							children: [(0, react_jsx_runtime.jsx)("strong", { children: `${t("failed")}: ` }), error ?? loadError]
						})
					})
				]
			});
		}

		/**
		 * The `shell.overlay` entry: nothing while no delete is requested,
		 * otherwise one dialog per request.
		 *
		 * @param {object} props - The request hook, its settlement, and the host shares.
		 * @returns {object|null} the open dialog.
		 */
		function DeleteSessionDialog(props) {
			const { useDeleteRequest, settleDeleteRequest, describeSession, deleteSession, t } = props;
			const request = useDeleteRequest((pending) => pending);
			if (request === null) return null;
			return (0, react_jsx_runtime.jsx)(DeleteSessionForm, {
				request,
				describeSession,
				deleteSession,
				onSettle: settleDeleteRequest,
				t
			}, request.sessionId);
		}

		/** Services this half needs; the rest is reached through the slot system. */
		const inject = ["slots", "locale", "connection"];

		/**
		 * Register the dictionaries, the menu row and the dialog once the sidebar
		 * has declared the slot this plugin contributes to.
		 *
		 * @param {object} ctx - Client root context.
		 * @returns {void}
		 */
		function apply(ctx) {
			const deleteRequest = createStore(null);
			/**
			 * Ids this page has deleted. The Host's session list is persistence ∪
			 * live, and `sessions.refresh()` rebuilds the browser's rows from that
			 * list — so an id the Host has not released yet comes back and wipes
			 * out earlier deletions (delete A, delete B, A reappears). Re-applying
			 * every retirement after each refresh keeps the rows retired until the
			 * Host's own `api-session/removed` agrees.
			 */
			const retired = new Set();
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "session-delete: dictionaries");

			const menuInjected = () => ({
				hooks: { deleteRequest },
				requestSessionDelete: (request) => deleteRequest.set(request)
			});
			const dialogInjected = () => ({
				hooks: { deleteRequest },
				settleDeleteRequest: () => deleteRequest.set(null),
				describeSession: (sessionId) => callHost(ctx, "describe", { sessionId }),
				deleteSession: async (sessionId) => {
					const result = await callHost(ctx, "deleteSession", { sessionId });
					// Nothing announces a session removed from disk, so the row has
					// to be retired here. Refreshing first drops a cold session,
					// because the list is rebuilt from persistence and the log is
					// gone; a session the Host still holds live is listed from its
					// live owner and survives that, so local removals go last — for
					// every id this page deleted, not just this one, because the
					// refresh has already re-admitted the earlier ones.
					retired.add(sessionId);
					const sessions = ctx.get("sessions");
					await sessions?.refresh();
					for (const id of retired) sessions?.handleSessionRemoved(id);
					return result;
				}
			});

			ctx.slots.inject("sidebar.workspaces.session.menu.item", () => ctx.slots.register({
				name: "sidebar.workspaces.session.menu.item",
				id: "dsh-tool-session-delete",
				order: 500,
				locale: NS,
				inject: menuInjected
			}, DeleteSessionMenuItem));

			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "dsh-tool-session-delete",
				locale: NS,
				inject: dialogInjected
			}, DeleteSessionDialog));
		}

		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});
