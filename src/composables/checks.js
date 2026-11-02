// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { onMounted, ref } from "vue";
import { extend } from "quasar";
import { fetchAgent, fetchAgentChecks } from "@/api/agents";
import { fetchPolicyChecks } from "@/api/automation";
import { saveCheck, updateCheck } from "@/api/checks";
import { formatCheckOptions } from "@/utils/format";
import { notifySuccess } from "@/utils/notify";
import { isValidThreshold } from "@/utils/validation";

const byLabel = (a, b) => a.label.localeCompare(b.label);

// check types that need a threshold pair; the flag says the values are
// "free space left", so warning has to sit above error instead of below
const THRESHOLD_TYPES = { cpuload: false, memory: false, diskspace: true };

const MISSING_OWNER =
  "Need to specify agent or policy object when calling getCheckOptions";

const FAIL_COUNTS = Array.from({ length: 10 }, (_, i) => i + 1);
const DRIVE_LETTERS = Array.from(
  { length: 26 },
  (_, i) => `${String.fromCharCode(65 + i)}:`,
);
const SEVERITIES = [
  { label: "Informational", value: "info" },
  { label: "Warning", value: "warning" },
  { label: "Error", value: "error" },
];
const EVENT_LOGS = ["Application", "System", "Security"];
const EVENT_LOG_MATCH = [
  { label: "Log contains", value: "contains" },
  { label: "Log does not contain", value: "not_contains" },
];

// editCheck: the check being edited, initialState: defaults for a new one
export function useCheckModal({ editCheck, initialState }) {
  // a deep copy: a cancelled edit must not change the table row's lists
  const state = ref(editCheck ? extend(true, {}, editCheck) : initialState);
  const loading = ref(false);
  const diskOptions = ref(DRIVE_LETTERS);
  const serviceOptions = ref(Object.freeze(defaultServiceOptions));

  function thresholdsOk(c) {
    if (!(c.check_type in THRESHOLD_TYPES)) return true;
    return isValidThreshold(
      c.warning_threshold,
      c.error_threshold,
      THRESHOLD_TYPES[c.check_type],
    );
  }

  async function submit(onOk) {
    const c = state.value;
    if (!thresholdsOk(c)) return;

    loading.value = true;
    try {
      notifySuccess(
        editCheck ? await updateCheck(c.id, c) : await saveCheck(c),
      );
      onOk();
    } catch (e) {
      console.error("check save failed", e?.response?.status);
    }
    loading.value = false;
  }

  // a new disk or service check preselects from what the agent reports
  async function loadAgentChoices() {
    const c = state.value;
    const wanted = ["diskspace", "winsvc"].includes(c.check_type);
    if (editCheck || !c.agent || !wanted) return;

    const { disks, services } = await fetchAgent(c.agent);
    // an agent that has not reported yet keeps the fallback lists
    if (c.check_type === "diskspace") {
      if (!disks?.length) return;
      diskOptions.value = disks.map((d) => d.device);
      c.disk = diskOptions.value[0];
      return;
    }
    if (!services?.length) return;
    const found = services
      .map((s) => ({ label: s.display_name, value: s.name }))
      .sort(byLabel);
    serviceOptions.value = Object.freeze(found);
    c.svc_name = found[0].value;
    c.svc_display_name = found[0].label;
  }

  onMounted(loadAgentChoices);

  return {
    state,
    loading,
    submit,
    diskOptions,
    serviceOptions,
    failOptions: FAIL_COUNTS,
    severityOptions: SEVERITIES,
    logNameOptions: EVENT_LOGS,
    failWhenOptions: EVENT_LOG_MATCH,
  };
}

export function useCheckDropdown() {
  const checkOptions = ref([]);

  async function getCheckOptions({ agent, policy }, flat = false) {
    if (!agent && !policy) {
      console.error(MISSING_OWNER);
      return;
    }
    try {
      const list = agent
        ? await fetchAgentChecks(agent)
        : await fetchPolicyChecks(policy);
      checkOptions.value = formatCheckOptions(list, flat);
    } catch (e) {
      console.error("loading checks failed", e?.response?.status);
    }
  }

  return { check: ref(null), checks: ref([]), checkOptions, getCheckOptions };
}

// fallback service list (service name, display name) for policy checks
// and agents that have not reported their services yet
const KNOWN_SERVICES = [
  ["AarSvc_35b28a", "Agent Activation Runtime_35b28a"],
  ["AJRouter", "AllJoyn Router Service"],
  ["ALG", "Application Layer Gateway Service"],
  ["AppIDSvc", "Application Identity"],
  ["Appinfo", "Application Information"],
  ["AppMgmt", "Application Management"],
  ["AppReadiness", "App Readiness"],
  ["AppVClient", "Microsoft App-V Client"],
  ["AppXSvc", "AppX Deployment Service (AppXSVC)"],
  ["AssignedAccessManagerSvc", "AssignedAccessManager Service"],
  ["atashost", "WebEx Service Host for Support Center"],
  ["AudioEndpointBuilder", "Windows Audio Endpoint Builder"],
  ["Audiosrv", "Windows Audio"],
  ["autotimesvc", "Cellular Time"],
  ["AxInstSV", "ActiveX Installer (AxInstSV)"],
  ["BcastDVRUserService_35b28a", "GameDVR and Broadcast User Service_35b28a"],
  ["BDESVC", "BitLocker Drive Encryption Service"],
  ["BFE", "Base Filtering Engine"],
  ["BITS", "Background Intelligent Transfer Service"],
  ["BluetoothUserService_35b28a", "Bluetooth User Support Service_35b28a"],
  ["Bonjour Service", "Bonjour Service"],
  ["BrokerInfrastructure", "Background Tasks Infrastructure Service"],
  ["BTAGService", "Bluetooth Audio Gateway Service"],
  ["BthAvctpSvc", "AVCTP service"],
  ["bthserv", "Bluetooth Support Service"],
  ["camsvc", "Capability Access Manager Service"],
  ["CaptureService_35b28a", "CaptureService_35b28a"],
  ["cbdhsvc_35b28a", "Clipboard User Service_35b28a"],
  ["CDPSvc", "Connected Devices Platform Service"],
  ["CDPUserSvc_35b28a", "Connected Devices Platform User Service_35b28a"],
  ["CertPropSvc", "Certificate Propagation"],
  ["ClipSVC", "Client License Service (ClipSVC)"],
  ["COMSysApp", "COM+ System Application"],
  ["ConsentUxUserSvc_35b28a", "ConsentUX_35b28a"],
  ["CoreMessagingRegistrar", "CoreMessaging"],
  ["cphs", "Intel(R) Content Protection HECI Service"],
  ["cplspcon", "Intel(R) Content Protection HDCP Service"],
  [
    "CredentialEnrollmentManagerUserSvc_35b28a",
    "CredentialEnrollmentManagerUserSvc_35b28a",
  ],
  ["CryptSvc", "Cryptographic Services"],
  ["CscService", "Offline Files"],
  ["DcomLaunch", "DCOM Server Process Launcher"],
  ["defragsvc", "Optimize drives"],
  ["DeviceAssociationBrokerSvc_35b28a", "DeviceAssociationBroker_35b28a"],
  ["DeviceAssociationService", "Device Association Service"],
  ["DeviceInstall", "Device Install Service"],
  ["DevicePickerUserSvc_35b28a", "DevicePicker_35b28a"],
  ["DevicesFlowUserSvc_35b28a", "DevicesFlow_35b28a"],
  ["DevQueryBroker", "DevQuery Background Discovery Broker"],
  ["Dhcp", "DHCP Client"],
  [
    "diagnosticshub.standardcollector.service",
    "Microsoft (R) Diagnostics Hub Standard Collector Service",
  ],
  ["diagsvc", "Diagnostic Execution Service"],
  ["DiagTrack", "Connected User Experiences and Telemetry"],
  ["DispBrokerDesktopSvc", "Display Policy Service"],
  ["DisplayEnhancementService", "Display Enhancement Service"],
  ["DmEnrollmentSvc", "Device Management Enrollment Service"],
  [
    "dmwappushservice",
    "Device Management Wireless Application Protocol (WAP) Push message Routing Service",
  ],
  ["Dnscache", "DNS Client"],
  ["DoSvc", "Delivery Optimization"],
  ["dot3svc", "Wired AutoConfig"],
  ["DPS", "Diagnostic Policy Service"],
  ["DsmSvc", "Device Setup Manager"],
  ["DsSvc", "Data Sharing Service"],
  ["DusmSvc", "Data Usage"],
  ["Eaphost", "Extensible Authentication Protocol"],
  ["EFS", "Encrypting File System (EFS)"],
  ["embeddedmode", "Embedded Mode"],
  ["EntAppSvc", "Enterprise App Management Service"],
  ["EventLog", "Windows Event Log"],
  ["EventSystem", "COM+ Event System"],
  ["Fax", "Fax"],
  ["fdPHost", "Function Discovery Provider Host"],
  ["FDResPub", "Function Discovery Resource Publication"],
  ["fhsvc", "File History Service"],
  ["FontCache", "Windows Font Cache Service"],
  ["FrameServer", "Windows Camera Frame Server"],
  ["GoogleChromeElevationService", "Google Chrome Elevation Service"],
  ["gpsvc", "Group Policy Client"],
  ["GraphicsPerfSvc", "GraphicsPerfSvc"],
  ["hidserv", "Human Interface Device Service"],
  ["hns", "Host Network Service"],
  ["HvHost", "HV Host Service"],
  ["ibtsiva", "Intel Bluetooth Service"],
  ["icssvc", "Windows Mobile Hotspot Service"],
  ["IKEEXT", "IKE and AuthIP IPsec Keying Modules"],
  ["InstallService", "Microsoft Store Install Service"],
  ["iphlpsvc", "IP Helper"],
  ["IpxlatCfgSvc", "IP Translation Configuration Service"],
  ["KeyIso", "CNG Key Isolation"],
  ["KtmRm", "KtmRm for Distributed Transaction Coordinator"],
  ["LanmanServer", "Server"],
  ["LanmanWorkstation", "Workstation"],
  ["lfsvc", "Geolocation Service"],
  ["LicenseManager", "Windows License Manager Service"],
  ["lltdsvc", "Link-Layer Topology Discovery Mapper"],
  ["lmhosts", "TCP/IP NetBIOS Helper"],
  ["LSM", "Local Session Manager"],
  ["LxpSvc", "Language Experience Service"],
  ["LxssManager", "LxssManager"],
  ["LxssManagerUser_35b28a", "LxssManagerUser_35b28a"],
  ["MapsBroker", "Downloaded Maps Manager"],
  ["Mesh Agent", "Mesh Agent background service"],
  ["MessagingService_35b28a", "MessagingService_35b28a"],
  ["MMS", "Acronis Managed Machine Service"],
  ["mpssvc", "Windows Defender Firewall"],
  ["MSDTC", "Distributed Transaction Coordinator"],
  ["MSiSCSI", "Microsoft iSCSI Initiator Service"],
  ["msiserver", "Windows Installer"],
  ["NaturalAuthentication", "Natural Authentication"],
  ["NcaSvc", "Network Connectivity Assistant"],
  ["NcbService", "Network Connection Broker"],
  ["NcdAutoSetup", "Network Connected Devices Auto-Setup"],
  ["Net Driver HPZ12", "Net Driver HPZ12"],
  ["Netlogon", "Netlogon"],
  ["Netman", "Network Connections"],
  ["netprofm", "Network List Service"],
  ["NetSetupSvc", "Network Setup Service"],
  ["NetTcpPortSharing", "Net.Tcp Port Sharing Service"],
  ["NgcCtnrSvc", "Microsoft Passport Container"],
  ["NgcSvc", "Microsoft Passport"],
  ["NlaSvc", "Network Location Awareness"],
  ["nsi", "Network Store Interface Service"],
  ["nvagent", "Network Virtualization Service"],
  ["OneSyncSvc_35b28a", "Sync Host_35b28a"],
  ["OpenVPNService", "OpenVPNService"],
  ["OpenVPNServiceInteractive", "OpenVPN Interactive Service"],
  ["OpenVPNServiceLegacy", "OpenVPN Legacy Service"],
  ["ose64", "Office 64 Source Engine"],
  ["p2pimsvc", "Peer Networking Identity Manager"],
  ["p2psvc", "Peer Networking Grouping"],
  ["PcaSvc", "Program Compatibility Assistant Service"],
  ["PeerDistSvc", "BranchCache"],
  ["perceptionsimulation", "Windows Perception Simulation Service"],
  ["PerfHost", "Performance Counter DLL Host"],
  ["PhoneSvc", "Phone Service"],
  ["PimIndexMaintenanceSvc_35b28a", "Contact Data_35b28a"],
  ["pla", "Performance Logs & Alerts"],
  ["PlugPlay", "Plug and Play"],
  ["Pml Driver HPZ12", "Pml Driver HPZ12"],
  ["PNRPAutoReg", "PNRP Machine Name Publication Service"],
  ["PNRPsvc", "Peer Name Resolution Protocol"],
  ["PolicyAgent", "IPsec Policy Agent"],
  ["Power", "Power"],
  ["PrintNotify", "Printer Extensions and Notifications"],
  ["PrintWorkflowUserSvc_35b28a", "PrintWorkflow_35b28a"],
  ["ProfSvc", "User Profile Service"],
  ["PushToInstall", "Windows PushToInstall Service"],
  ["QWAVE", "Quality Windows Audio Video Experience"],
  ["RasAuto", "Remote Access Auto Connection Manager"],
  ["RasMan", "Remote Access Connection Manager"],
  ["RDMS", "Remote Desktop Management"],
  ["RemoteAccess", "Routing and Remote Access"],
  ["RemoteRegistry", "Remote Registry"],
  ["RetailDemo", "Retail Demo Service"],
  ["RmSvc", "Radio Management Service"],
  ["RpcEptMapper", "RPC Endpoint Mapper"],
  ["RpcLocator", "Remote Procedure Call (RPC) Locator"],
  ["RpcSs", "Remote Procedure Call (RPC)"],
  ["salt-minion", "salt-minion"],
  ["SamSs", "Security Accounts Manager"],
  ["SCardSvr", "Smart Card"],
  ["ScDeviceEnum", "Smart Card Device Enumeration Service"],
  ["Schedule", "Task Scheduler"],
  ["SCPolicySvc", "Smart Card Removal Policy"],
  ["SDRSVC", "Windows Backup"],
  ["seclogon", "Secondary Logon"],
  ["SecurityHealthService", "Windows Security Service"],
  ["SEMgrSvc", "Payments and NFC/SE Manager"],
  ["SENS", "System Event Notification Service"],
  ["Sense", "Windows Defender Advanced Threat Protection Service"],
  ["SensorDataService", "Sensor Data Service"],
  ["SensorService", "Sensor Service"],
  ["SensrSvc", "Sensor Monitoring Service"],
  ["SessionEnv", "Remote Desktop Configuration"],
  ["SgrmBroker", "System Guard Runtime Monitor Broker"],
  ["SharedAccess", "Internet Connection Sharing (ICS)"],
  ["SharedRealitySvc", "Spatial Data Service"],
  ["ShellHWDetection", "Shell Hardware Detection"],
  ["shpamsvc", "Shared PC Account Manager"],
  ["smphost", "Microsoft Storage Spaces SMP"],
  ["SmsRouter", "Microsoft Windows SMS Router Service."],
  ["SNMPTRAP", "SNMP Trap"],
  ["spectrum", "Windows Perception Service"],
  ["Spooler", "Print Spooler"],
  ["sppsvc", "Software Protection"],
  ["SSDPSRV", "SSDP Discovery"],
  ["ssh-agent", "OpenSSH Authentication Agent"],
  ["sshd", "OpenSSH SSH Server"],
  ["SstpSvc", "Secure Socket Tunneling Protocol Service"],
  ["StateRepository", "State Repository Service"],
  ["stisvc", "Windows Image Acquisition (WIA)"],
  ["StorSvc", "Storage Service"],
  ["svsvc", "Spot Verifier"],
  ["swprv", "Microsoft Software Shadow Copy Provider"],
  ["SynTPEnhService", "SynTPEnh Caller Service"],
  ["SysMain", "SysMain"],
  ["SystemEventsBroker", "System Events Broker"],
  ["TabletInputService", "Touch Keyboard and Handwriting Panel Service"],
  ["TapiSrv", "Telephony"],
  ["TermService", "Remote Desktop Services"],
  ["TermServLicensing", "Remote Desktop Licensing"],
  ["Themes", "Themes"],
  ["TieringEngineService", "Storage Tiers Management"],
  ["TimeBrokerSvc", "Time Broker"],
  ["TokenBroker", "Web Account Manager"],
  ["TrkWks", "Distributed Link Tracking Client"],
  ["TroubleshootingSvc", "Recommended Troubleshooting Service"],
  ["TrustedInstaller", "Windows Modules Installer"],
  ["TSGateway", "Remote Desktop Gateway"],
  ["Tssdis", "Remote Desktop Connection Broker"],
  ["tzautoupdate", "Auto Time Zone Updater"],
  ["UevAgentService", "User Experience Virtualization Service"],
  ["ulrmm-agent", "UniversalLocal RMM Agent"],
  ["UmRdpService", "Remote Desktop Services UserMode Port Redirector"],
  ["UnistoreSvc_35b28a", "User Data Storage_35b28a"],
  ["upnphost", "UPnP Device Host"],
  ["UserDataSvc_35b28a", "User Data Access_35b28a"],
  ["UserManager", "User Manager"],
  ["UsoSvc", "Update Orchestrator Service"],
  ["VacSvc", "Volumetric Audio Compositor Service"],
  ["VaultSvc", "Credential Manager"],
  ["vds", "Virtual Disk"],
  ["vmcompute", "Hyper-V Host Compute Service"],
  ["vmicguestinterface", "Hyper-V Guest Service Interface"],
  ["vmicheartbeat", "Hyper-V Heartbeat Service"],
  ["vmickvpexchange", "Hyper-V Data Exchange Service"],
  ["vmicrdv", "Hyper-V Remote Desktop Virtualization Service"],
  ["vmicshutdown", "Hyper-V Guest Shutdown Service"],
  ["vmictimesync", "Hyper-V Time Synchronization Service"],
  ["vmicvmsession", "Hyper-V PowerShell Direct Service"],
  ["vmicvss", "Hyper-V Volume Shadow Copy Requestor"],
  ["VSS", "Volume Shadow Copy"],
  ["W32Time", "Windows Time"],
  ["WaaSMedicSvc", "Windows Update Medic Service"],
  ["WalletService", "WalletService"],
  ["WarpJITSvc", "WarpJITSvc"],
  ["wbengine", "Block Level Backup Engine Service"],
  ["WbioSrvc", "Windows Biometric Service"],
  ["Wcmsvc", "Windows Connection Manager"],
  ["wcncsvc", "Windows Connect Now - Config Registrar"],
  ["WdiServiceHost", "Diagnostic Service Host"],
  ["WdiSystemHost", "Diagnostic System Host"],
  ["WdNisSvc", "Windows Defender Antivirus Network Inspection Service"],
  ["WebClient", "WebClient"],
  ["Wecsvc", "Windows Event Collector"],
  ["WEPHOSTSVC", "Windows Encryption Provider Host Service"],
  ["wercplsupport", "Problem Reports and Solutions Control Panel Support"],
  ["WerSvc", "Windows Error Reporting Service"],
  ["WFDSConMgrSvc", "Wi-Fi Direct Services Connection Manager Service"],
  ["WiaRpc", "Still Image Acquisition Events"],
  ["WinDefend", "Windows Defender Antivirus Service"],
  ["WinHttpAutoProxySvc", "WinHTTP Web Proxy Auto-Discovery Service"],
  ["Winmgmt", "Windows Management Instrumentation"],
  ["WinRM", "Windows Remote Management (WS-Management)"],
  ["wisvc", "Windows Insider Service"],
  ["WlanSvc", "WLAN AutoConfig"],
  ["wlidsvc", "Microsoft Account Sign-in Assistant"],
  ["wlpasvc", "Local Profile Assistant Service"],
  ["WManSvc", "Windows Management Service"],
  ["wmiApSrv", "WMI Performance Adapter"],
  ["WMPNetworkSvc", "Windows Media Player Network Sharing Service"],
  ["workfolderssvc", "Work Folders"],
  ["WpcMonSvc", "Parental Controls"],
  ["WPDBusEnum", "Portable Device Enumerator Service"],
  ["WpnService", "Windows Push Notifications System Service"],
  ["WpnUserService_35b28a", "Windows Push Notifications User Service_35b28a"],
  ["wscsvc", "Security Center"],
  ["WSearch", "Windows Search"],
  ["wuauserv", "Windows Update"],
  ["WwanSvc", "WWAN AutoConfig"],
  ["XblAuthManager", "Xbox Live Auth Manager"],
  ["XblGameSave", "Xbox Live Game Save"],
  ["XboxGipSvc", "Xbox Accessory Management Service"],
  ["XboxNetApiSvc", "Xbox Live Networking Service"],
  ["YMC", "YMC"],
];

export const defaultServiceOptions = KNOWN_SERVICES.map(([value, label]) => ({
  value,
  label,
})).sort(byLabel);
