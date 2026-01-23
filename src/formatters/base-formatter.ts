import { hashString } from '../utils/hash';

export abstract class BaseFormatter {
  protected generateHostId(hostName: string): string {
    // Generate a deterministic host ID based on hostname
    let hash = 0;
    for (let i = 0; i < hostName.length; i++) {
      const char = hostName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to a hex string similar to machine-id format
    const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
    return `${hexHash}${'0'.repeat(24)}`.substring(0, 32);
  }

  protected generateImageId(provider: string): string {
    const imageIds = {
      aws: ['ami-0abcdef1234567890', 'ami-0987654321fedcba0', 'ami-0123456789abcdef0'],
      gcp: ['ubuntu-2004-focal-v20231101', 'ubuntu-1804-bionic-v20231024', 'centos-7-v20231115'],
      azure: ['/subscriptions/12345/resourceGroups/mygroup/providers/Microsoft.Compute/images/myimage',
              '/subscriptions/67890/resourceGroups/production/providers/Microsoft.Compute/images/ubuntu-20-04']
    };
    
    const providerImages = imageIds[provider as keyof typeof imageIds] || imageIds.aws;
    return providerImages[Math.floor(Math.random() * providerImages.length)];
  }

  protected generateImageName(provider: string): string {
    const imageNames = {
      aws: ['ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server', 
            'amazon-linux-2-kernel-5.10-x86_64-gp2',
            'centos-7-x86_64-hvm-ebs'],
      gcp: ['ubuntu-2004-focal', 'ubuntu-1804-bionic', 'centos-7'],
      azure: ['Canonical:0001-com-ubuntu-server-focal:20_04-lts-gen2',
              'OpenLogic:CentOS:7_9-gen2', 'RedHat:RHEL:8-lvm-gen2']
    };
    
    const providerNames = imageNames[provider as keyof typeof imageNames] || imageNames.aws;
    return providerNames[Math.floor(Math.random() * providerNames.length)];
  }

  protected generateHostIPs(hostName: string): string[] {
    // Generate deterministic IPs based on hostname
    const hash = hashString(hostName);
    const lastOctet = (hash % 200) + 10; // 10-209
    const thirdOctet = ((hash >> 8) % 200) + 10; // 10-209
    
    return [
      `10.0.${thirdOctet}.${lastOctet}`, // Private IP
      `172.31.${thirdOctet}.${lastOctet}`, // VPC IP
      '127.0.0.1' // Loopback
    ];
  }

  protected generateHostMACs(hostName: string): string[] {
    // Generate deterministic MAC addresses based on hostname
    const hash = hashString(hostName);
    const mac1 = `02:42:ac:${((hash >> 16) & 0xff).toString(16).padStart(2, '0')}:${((hash >> 8) & 0xff).toString(16).padStart(2, '0')}:${(hash & 0xff).toString(16).padStart(2, '0')}`;
    
    return [mac1];
  }

}