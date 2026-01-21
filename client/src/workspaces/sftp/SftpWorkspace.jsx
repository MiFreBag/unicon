// client/src/workspaces/sftp/SftpWorkspace.jsx
import React from 'react'
import FtpWorkspace from '../ftp/FtpWorkspace.jsx'

export default function SftpWorkspace(props) {
  // Reuse FTP workspace with protocol overridden to 'sftp'
  return <FtpWorkspace {...props} protocol="sftp" />
}
