; Inno Setup Script for SoTube
; Designed for Inno Setup 6+
; Generates a clean, modern Windows Installer from dist\win-unpacked

#define MyAppName "SoTube"
#define MyAppVersion "26.0.0"
#define MyAppPublisher "SoTube"
#define MyAppExeName "SoTube.exe"

[Setup]
; Unique AppId generated for SoTube
AppId={{C8E397B1-4A3C-4D4E-9D45-E93856DE70AC}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
; Show the branded Welcome page before the License Agreement
DisableWelcomePage=no
; Hide the "Select Start Menu Folder" page
DisableProgramGroupPage=yes
LicenseFile=LICENSE.txt
; Allow installing per-user without admin privileges or system-wide if elevated
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=commandline
OutputDir=dist
OutputBaseFilename=SoTubeSetup
SetupIconFile=assets\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}
; Classic Inno Setup UI theme and branding
WizardStyle=classic
WizardImageFile=assets\sidebar.bmp
WizardSmallImageFile=assets\icon.bmp
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; Packages the entire pre-built win-unpacked directory
Source: "dist\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent

[Code]
procedure InitializeWizard();
begin
  { Use a clean window title instead of "Setup - SoTube version 26.0.0". }
  WizardForm.Caption := '{#MyAppName}';
  { Brand the built-in welcome page for SoTube. }
  WizardForm.WelcomeLabel1.Caption := 'Welcome to SoTube';
  WizardForm.WelcomeLabel2.Caption :=
    'SoTube is a fast, minimalist desktop client for discovering, downloading, and converting media.' + #13#10 + #13#10 +
    'This wizard will install SoTube {#MyAppVersion} on your computer.' + #13#10 +
    'It is recommended that you close all other applications before continuing.';
end;
