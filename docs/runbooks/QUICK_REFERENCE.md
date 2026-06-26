# Disaster Recovery Quick Reference

**Print this page and keep it accessible!**

---

## Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Incident Commander | TBD | TBD | TBD |
| Database Admin | TBD | TBD | TBD |
| DevOps Lead | TBD | TBD | TBD |
| On-Call Engineer | TBD | TBD | TBD |

**PagerDuty:** [Link]  
**Slack:** #yieldvault-war-room  
**Zoom:** [Emergency Meeting Link]

---

## Quick Decision Tree

```
What's failing?
│
├─ Everything down?
│  └─ Use: FULL_DR_PROCEDURE.md (4 hours)
│
├─ Database corrupted/down?
│  └─ Use: DATABASE_RESTORE.md (1 hour)
│
├─ Backend service down?
│  └─ Use: BACKEND_REDEPLOY.md (30 min)
│
└─ Stellar RPC failing?
   └─ Use: RPC_FAILOVER.md (5 min)
```

---

## RTO/RPO Targets

| Component | RTO | RPO |
|-----------|-----|-----|
| Database | 1 hour | 15 min |
| Backend | 30 min | N/A |
| RPC | 5 min | N/A |
| Full System | 4 hours | 15 min |

---

## Critical Commands

### Check System Health

```bash
# Backend health
curl http://localhost:3000/health

# Database connection
psql $DATABASE_URL -c "SELECT 1"

# RPC connection
curl -X POST $STELLAR_RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "getHealth"}'
```

### Quick Service Restart

```bash
# Backend (systemd)
sudo systemctl restart yieldvault-backend

# Backend (PM2)
pm2 restart yieldvault-backend

# Backend (Docker)
docker restart yieldvault-backend
```

### Check Logs

```bash
# Application logs
tail -f /var/log/yieldvault/backend.log

# System logs
journalctl -u yieldvault-backend -f

# Docker logs
docker logs -f yieldvault-backend
```

### Replay & State Recovery

```bash
# Trigger manual ledger events replay (dry-run)
curl -X POST http://localhost:3000/admin/events/replay \
  -H "Authorization: ApiKey YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"fromLedger": 152000, "toLedger": 152500, "dryRun": true}'

# Execute manual ledger events replay
curl -X POST http://localhost:3000/admin/events/replay \
  -H "Authorization: ApiKey YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"fromLedger": 152000, "toLedger": 152500}'

# Replay failed email queue item by UUID
curl -X POST http://localhost:3000/admin/emails/replay/YOUR_EMAIL_UUID \
  -H "Authorization: ApiKey YOUR_ADMIN_API_KEY"
```

---

## Backup Locations

| Type | Location |
|------|----------|
| Database | s3://yieldvault-backups/database/ |
| Config | s3://yieldvault-backups/config/ |
| Code | https://github.com/yieldvault/backend |
| Secrets | [Secret Manager] |

---

## Runbook Locations

All runbooks: `docs/runbooks/`

- [RTO/RPO Targets](./RTO_RPO_TARGETS.md)
- [Database Restore](./DATABASE_RESTORE.md)
- [Backend Redeploy](./BACKEND_REDEPLOY.md)
- [RPC Failover](./RPC_FAILOVER.md)
- [Full DR](./FULL_DR_PROCEDURE.md)
- [Replay Procedures](./REPLAY_PROCEDURES.md)

---

## Incident Response Steps

1. **Detect** - Monitoring alert or user report
2. **Assess** - Determine severity and scope
3. **Notify** - Alert team via PagerDuty/Slack
4. **Respond** - Follow appropriate runbook
5. **Verify** - Confirm system restored
6. **Document** - Create incident report
7. **Review** - Post-mortem within 48 hours

---

## Communication Templates

### Slack Alert

```
🚨 INCIDENT: [Brief Description]
Severity: [Critical/High/Medium/Low]
Affected: [Components]
ETA: [Time]
Runbook: [Link]
War Room: #yieldvault-war-room
```

### Status Update

```
📊 UPDATE: [Incident Name]
Status: [In Progress/Resolved]
Progress: [X/Y steps complete]
ETA: [Updated time]
Next: [Next action]
```

### Resolution

```
✅ RESOLVED: [Incident Name]
Duration: [X hours]
Impact: [Description]
Root Cause: [Brief]
Follow-up: [Ticket link]
```

---

## Pre-Flight Checklist

Before starting recovery:

- [ ] Incident ticket created
- [ ] Team notified
- [ ] War room created
- [ ] Backups verified
- [ ] Runbook selected
- [ ] Prerequisites checked
- [ ] Rollback plan ready

---

## Post-Recovery Checklist

After recovery complete:

- [ ] System health verified
- [ ] Monitoring active
- [ ] Stakeholders notified
- [ ] Incident documented
- [ ] Post-mortem scheduled
- [ ] Runbooks updated

---

## Key Metrics

Track these for every incident:

- Detection time
- Response time
- Recovery time
- Data loss
- Root cause
- Lessons learned

---

**Keep this reference handy!**  
**Last Updated:** April 29, 2026
