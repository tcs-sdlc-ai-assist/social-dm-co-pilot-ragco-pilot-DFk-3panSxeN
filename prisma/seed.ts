import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.draft.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.dM.deleteMany();
  await prisma.user.deleteMany();

  // Create sample users
  const agentUser = await prisma.user.create({
    data: {
      id: "user-agent-001",
      name: "Alex Thompson",
      email: "alex.thompson@stockland.com.au",
      role: "agent",
    },
  });

  const managerUser = await prisma.user.create({
    data: {
      id: "user-manager-001",
      name: "Rachel Chen",
      email: "rachel.chen@stockland.com.au",
      role: "manager",
    },
  });

  // Create sample DMs
  const dmSarah = await prisma.dM.create({
    data: {
      id: "dm-001",
      platform: "instagram",
      senderName: "Sarah M.",
      senderHandle: "@sarah_m_designs",
      message:
        "Hi! I've been looking at the Aura community in Calleya. We're a young family with a budget around $500-550k. Could you tell me more about the 4-bedroom options and what's available for move-in by March? We're currently renting in Cockburn and really love the area.",
      timestamp: new Date("2024-11-15T09:23:00Z"),
      status: "new",
    },
  });

  const dmJames = await prisma.dM.create({
    data: {
      id: "dm-002",
      platform: "facebook",
      senderName: "James M.",
      senderHandle: "james.mitchell.904",
      message:
        "Hey there, I saw your ad about the new land release at Willowdale. I'm an investor looking at blocks under $400k. What's the expected rental yield in that area? Also interested in any house and land packages you might have.",
      timestamp: new Date("2024-11-15T11:45:00Z"),
      status: "new",
    },
  });

  const dmPriya = await prisma.dM.create({
    data: {
      id: "dm-003",
      platform: "instagram",
      senderName: "Priya B.",
      senderHandle: "@priya.bhatt",
      message:
        "Hello! My husband and I are first home buyers. We've been pre-approved for $620k and are interested in the Elara estate in Marsden Park. Do you have any 3-bed homes with a study? We both work from home. When is the next display home open day?",
      timestamp: new Date("2024-11-14T16:30:00Z"),
      status: "replied",
    },
  });

  const dmTom = await prisma.dM.create({
    data: {
      id: "dm-004",
      platform: "facebook",
      senderName: "Tom R.",
      senderHandle: "tom.russo.77",
      message:
        "Just wondering about the retirement living options at Cardinal Freeman. My mum is looking to downsize from her 4-bed house. She'd want a 2-bed unit with parking. Budget is flexible but probably around $800k-1M. Is there a waitlist?",
      timestamp: new Date("2024-11-14T08:12:00Z"),
      status: "new",
    },
  });

  const dmAnika = await prisma.dM.create({
    data: {
      id: "dm-005",
      platform: "instagram",
      senderName: "Anika J.",
      senderHandle: "@anika.jones.living",
      message:
        "Love what you're doing at Cloverton! 😍 We're thinking of building our dream home there. Budget is around $700k for house and land. Are there any premium corner lots still available? We want north-facing if possible. Happy to chat more!",
      timestamp: new Date("2024-11-15T14:05:00Z"),
      status: "new",
    },
  });

  // Create sample drafts
  await prisma.draft.create({
    data: {
      id: "draft-001",
      dmId: dmSarah.id,
      content:
        "Hi Sarah! 👋 Thanks so much for your interest in Aura at Calleya — it's a beautiful community and perfect for young families!\n\nGreat news — we do have 4-bedroom options available in your budget range. For $500-550k, I'd recommend looking at our Aspire series which starts from $499k for a 4-bed, 2-bath home.\n\nRegarding your March timeline, we have several homes in the final stages of construction that could work. I'd love to arrange a time for you to visit our display village and chat with our sales team about what's available.\n\nWould Saturday or Sunday this week work for a visit? 🏡",
      confidenceScore: 0.92,
      isEdited: false,
      status: "pending",
    },
  });

  await prisma.draft.create({
    data: {
      id: "draft-002",
      dmId: dmJames.id,
      content:
        "Hi James! Thanks for reaching out about Willowdale — it's one of our most popular communities for investors.\n\nWe currently have land blocks available from $350k in the latest release. The area has been seeing strong rental yields of around 4.2-4.5%, and with the new infrastructure developments planned, we expect continued growth.\n\nWe also have several house and land packages starting from $580k that are very popular with investors due to the depreciation benefits.\n\nWould you like me to send through our investor information pack with detailed yield projections? I can also connect you with our finance team who specialise in investment purchases.",
      confidenceScore: 0.87,
      isEdited: false,
      status: "pending",
    },
  });

  await prisma.draft.create({
    data: {
      id: "draft-003",
      dmId: dmPriya.id,
      content:
        "Hi Priya! Congratulations on your pre-approval — that's a great step! 🎉\n\nElara at Marsden Park is a wonderful choice, especially for those working from home. We have several 3-bedroom + study floor plans that would be perfect for you and your husband.\n\nWith your $620k budget, I'd suggest looking at our Harmony range which includes a dedicated study nook and open-plan living — ideal for WFH!\n\nOur next display home open day is this Saturday from 10am-4pm. I'd love to show you around personally. As first home buyers, you may also be eligible for the $10,000 First Home Owner Grant.\n\nShall I reserve a time slot for you on Saturday?",
      confidenceScore: 0.95,
      isEdited: true,
      status: "sent",
    },
  });

  await prisma.draft.create({
    data: {
      id: "draft-004",
      dmId: dmTom.id,
      content:
        "Hi Tom! How lovely that you're helping your mum find her next home. Cardinal Freeman is a truly special retirement community.\n\nWe have 2-bedroom apartments available with secure parking, and the $800k-1M range gives her some excellent options including our premium units with harbour glimpses.\n\nThere isn't a formal waitlist at the moment, but availability does move quickly. I'd recommend booking a private tour so your mum can see the facilities — we have a wonderful community centre, pool, and gardens.\n\nWould you and your mum be available for a tour this week? I can arrange a one-on-one with our retirement living specialist.",
      confidenceScore: 0.89,
      isEdited: false,
      status: "pending",
    },
  });

  await prisma.draft.create({
    data: {
      id: "draft-005",
      dmId: dmAnika.id,
      content:
        "Hi Anika! So glad you love Cloverton — it really is a special place to build! 🏡✨\n\nGreat news — we do have some premium corner lots still available, including a couple of north-facing options which are always in high demand. For a $700k house and land budget, you'd be looking at our larger lots (around 448-512sqm) paired with one of our quality builder partners.\n\nI'd love to show you the available lots on our interactive map and discuss the build process. Our design consultants can also help you plan your dream home layout.\n\nAre you free for a chat this week? I can walk you through everything! 😊",
      confidenceScore: 0.91,
      isEdited: false,
      status: "pending",
    },
  });

  // Create sample leads
  const leadSarah = await prisma.lead.create({
    data: {
      id: "lead-001",
      dmId: dmSarah.id,
      name: "Sarah M.",
      contact: "@sarah_m_designs (Instagram)",
      budget: "$500,000 - $550,000",
      location: "Aura at Calleya",
      intent: "Family home purchase — 4 bedroom, move-in by March",
      score: 8.5,
      priorityFlag: true,
      status: "new",
      assignedTo: agentUser.id,
    },
  });

  const leadJames = await prisma.lead.create({
    data: {
      id: "lead-002",
      dmId: dmJames.id,
      name: "James M.",
      contact: "james.mitchell.904 (Facebook)",
      budget: "Under $400,000 (land) / $580,000+ (H&L package)",
      location: "Willowdale",
      intent: "Investment property — land or house and land package",
      score: 7.2,
      priorityFlag: false,
      status: "new",
      assignedTo: agentUser.id,
    },
  });

  const leadPriya = await prisma.lead.create({
    data: {
      id: "lead-003",
      dmId: dmPriya.id,
      name: "Priya B.",
      contact: "@priya.bhatt (Instagram)",
      budget: "$620,000 (pre-approved)",
      location: "Elara, Marsden Park",
      intent: "First home buyer — 3 bed + study, WFH setup",
      score: 9.1,
      priorityFlag: true,
      status: "contacted",
      assignedTo: agentUser.id,
    },
  });

  const leadTom = await prisma.lead.create({
    data: {
      id: "lead-004",
      dmId: dmTom.id,
      name: "Tom R.",
      contact: "tom.russo.77 (Facebook)",
      budget: "$800,000 - $1,000,000",
      location: "Cardinal Freeman",
      intent: "Retirement living — 2 bed unit with parking for mother",
      score: 8.0,
      priorityFlag: true,
      status: "new",
      assignedTo: null,
    },
  });

  const leadAnika = await prisma.lead.create({
    data: {
      id: "lead-005",
      dmId: dmAnika.id,
      name: "Anika J.",
      contact: "@anika.jones.living (Instagram)",
      budget: "$700,000 (house and land)",
      location: "Cloverton",
      intent: "Dream home build — premium corner lot, north-facing",
      score: 8.8,
      priorityFlag: true,
      status: "new",
      assignedTo: agentUser.id,
    },
  });

  // Create sample notifications
  await prisma.notification.create({
    data: {
      id: "notif-001",
      leadId: leadSarah.id,
      dmId: dmSarah.id,
      type: "high_priority_lead",
      status: "unread",
      recipient: agentUser.email,
      details: "New high-priority lead from Sarah M. — family home buyer with $500-550k budget, looking for 4-bed at Aura Calleya.",
    },
  });

  await prisma.notification.create({
    data: {
      id: "notif-002",
      leadId: leadPriya.id,
      dmId: dmPriya.id,
      type: "high_priority_lead",
      status: "read",
      recipient: agentUser.email,
      details: "High-priority lead from Priya B. — pre-approved first home buyer at $620k for Elara, Marsden Park.",
    },
  });

  await prisma.notification.create({
    data: {
      id: "notif-003",
      leadId: leadTom.id,
      dmId: dmTom.id,
      type: "unassigned_lead",
      status: "unread",
      recipient: managerUser.email,
      details: "New lead from Tom R. for Cardinal Freeman retirement living ($800k-1M) is unassigned. Please assign an agent.",
    },
  });

  await prisma.notification.create({
    data: {
      id: "notif-004",
      leadId: leadAnika.id,
      dmId: dmAnika.id,
      type: "high_priority_lead",
      status: "unread",
      recipient: agentUser.email,
      details: "New high-priority lead from Anika J. — $700k H&L budget at Cloverton, wants premium north-facing corner lot.",
    },
  });

  await prisma.notification.create({
    data: {
      id: "notif-005",
      dmId: dmJames.id,
      leadId: leadJames.id,
      type: "new_dm",
      status: "unread",
      recipient: agentUser.email,
      details: "New DM from James M. on Facebook regarding investment opportunities at Willowdale.",
    },
  });

  // Create sample audit logs
  await prisma.auditLog.create({
    data: {
      action: "draft_sent",
      entityType: "draft",
      entityId: "draft-003",
      userId: agentUser.id,
      details: "Agent sent approved draft reply to Priya B. via Instagram DM.",
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "lead_created",
      entityType: "lead",
      entityId: leadSarah.id,
      userId: null,
      details: "Lead auto-created from Instagram DM by Sarah M. Score: 8.5, Priority: High.",
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "lead_assigned",
      entityType: "lead",
      entityId: leadAnika.id,
      userId: managerUser.id,
      details: "Lead for Anika J. assigned to agent Alex Thompson by manager Rachel Chen.",
    },
  });

  console.log("✅ Seed data created successfully!");
  console.log(`   - 2 users (agent + manager)`);
  console.log(`   - 5 DMs (Sarah M., James M., Priya B., Tom R., Anika J.)`);
  console.log(`   - 5 drafts with confidence scores`);
  console.log(`   - 5 leads with scores and priority flags`);
  console.log(`   - 5 notifications`);
  console.log(`   - 3 audit logs`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });