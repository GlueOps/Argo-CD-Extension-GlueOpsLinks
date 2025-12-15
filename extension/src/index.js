(function() {
  'use strict';
  
  // Helper function to format relative time from ISO timestamp
  function formatRelativeTime(isoTimestamp) {
    if (!isoTimestamp) return '';
    const now = new Date();
    const then = new Date(isoTimestamp);
    const diffMs = now - then;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSeconds < 60) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }
  
  function initExtension() {
    if (typeof window.extensionsAPI === 'undefined') {
      setTimeout(initExtension, 500);
      return;
    }
    const extensionsAPI = window.extensionsAPI;
    function AppLinksComponent(props) {
      const application = props?.application || props?.item || props;
      const appName = application?.metadata?.name || application?.name || props?.name || '';
      const appNamespace = application?.metadata?.namespace || application?.namespace || props?.namespace || 'argocd';
      if (!appName) {
        return React.createElement('div', { style: { padding: '16px', color: '#666' } }, 'Application name not found');
      }
      const [categories, setCategories] = React.useState([]);
      const [lastUpdated, setLastUpdated] = React.useState(null);
      const [maxRows, setMaxRows] = React.useState(4);
      const [loading, setLoading] = React.useState(true);
      const [error, setError] = React.useState(null);
      const [hoveredGroup, setHoveredGroup] = React.useState(null);
      React.useEffect(() => {
        if (!appName) {
          setLoading(false);
          return;
        }
      const fetchLinks = async () => {
        try {
          setLoading(true);
          setError(null);
          const headerValue = `${appNamespace}:${appName}`;
          const projectName = application?.spec?.project || 'default';
          const headers = new Headers();
          headers.set('Accept', 'application/json');
          headers.set('Argocd-Application-Name', headerValue);
          headers.set('Argocd-Project-Name', projectName);
          
          // Create abort controller for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          try {
            // Call ArgoCD proxy extension with new API path pattern
            const response = await fetch(`/extensions/app-links-extension/api/v1/mock/applications/${appName}/links`, {
              method: 'GET',
              credentials: 'include',
              headers: headers,
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
              // Server returned error status
              setError('offline');
              setCategories([]);
              return;
            }
            const data = await response.json();
            
            // Extract categories array and metadata from API response
            setCategories(data.categories || []);
            setLastUpdated(data.metadata.last_updated);
            setMaxRows(data.metadata.max_rows);
          } catch (fetchErr) {
            clearTimeout(timeoutId);
            throw fetchErr;
          }
        } catch (err) {
          // Network error, timeout, or other fetch failure
          // Silently handle - don't crash ArgoCD
          setError('offline');
          setCategories([]);
        } finally {
          setLoading(false);
        }
      };
        fetchLinks();
      }, [appName, appNamespace]);
      const hasData = categories.length > 0 && !error;
      
      // GlueOps logo from CDN
      const beeLogo = React.createElement('img', {
        src: 'https://cdn.glueops.dev/logos/logo.png',
        alt: 'GlueOps Logo',
        style: {
          width: '20px',
          height: '20px',
          marginRight: '6px',
          flexShrink: 0,
          objectFit: 'contain'
        }
      });
      
      return React.createElement('div', { 
        style: { 
          padding: '4px 8px',
          backgroundColor: '#ffffff',
          borderRadius: '4px',
          border: '1px solid #e0e0e0',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          margin: '0',
          minHeight: 'auto',
          overflow: 'visible'
        } 
      },
        React.createElement('div', { 
          style: { 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '4px',
            paddingBottom: '4px',
            borderBottom: '1px solid #f0f0f0'
          } 
        },
          React.createElement('div', {
            style: {
              display: 'flex',
              alignItems: 'center'
            }
          },
            beeLogo,
            React.createElement('h3', { 
              style: { 
                margin: 0,
                fontSize: '12px',
                fontWeight: 600,
                color: '#1a1a1a',
                letterSpacing: '-0.1px',
                lineHeight: '1.2',
                whiteSpace: 'nowrap'
              } 
            }, 'GlueOps')
          ),
          React.createElement('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '10px',
              color: '#888',
              whiteSpace: 'nowrap'
            }
          },
            React.createElement('span', {
              style: { color: '#999' }
            }, 'v' + __EXTENSION_VERSION__),
            lastUpdated && React.createElement('span', {}, '•'),
            lastUpdated && React.createElement('span', {}, formatRelativeTime(lastUpdated))
          )
        ),
        loading ? React.createElement('div', { 
          style: { 
            textAlign: 'center', 
            color: '#666', 
            padding: '8px 0',
            fontSize: '11px'
          } 
        }, '⏳ Loading...') :
        error ? React.createElement('div', { 
          style: { 
            textAlign: 'center', 
            color: '#f59e0b', 
            padding: '8px 0',
            fontSize: '11px'
          } 
        }, '⚠️ Service Unavailable') :
        categories.length === 0 ? React.createElement('div', { 
          style: { 
            textAlign: 'center', 
            color: '#999', 
            padding: '8px 0',
            fontSize: '11px'
          } 
        }, '📭 No links available') :
        React.createElement('div', { 
          style: { 
            display: 'grid',
            gridTemplateRows: 'repeat(' + maxRows + ', auto)',
            gridAutoFlow: 'column',
            gap: '4px',
            position: 'relative',
            overflow: 'visible'
          } 
        },
          categories.map((category, groupIdx) => {
            const { id, label: groupLabel, icon, status, message, links: categoryLinks } = category;
            const links = categoryLinks || [];
            const isHovered = hoveredGroup === groupIdx;
            const hasLinks = links.length > 0 && status === 'ok';
            const isSingleLink = links.length === 1;
            const isEmptyOrError = status === 'empty' || status === 'error';
            
            return React.createElement('div', {
              key: id || groupIdx,
              style: { position: 'relative' },
              onMouseEnter: () => setHoveredGroup(groupIdx),
              onMouseLeave: () => setHoveredGroup(null)
            }, 
              // Empty or error state - show message in muted color
              isEmptyOrError ? React.createElement('div', {
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '4px 6px',
                  backgroundColor: '#fafafa',
                  border: '1px solid #e1e4e8',
                  borderRadius: '3px',
                  fontSize: '11px'
                }
              },
                React.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500, color: '#24292f', marginBottom: '2px' } },
                  React.createElement('span', { style: { fontSize: '12px', flexShrink: 0 } }, icon || '🔗'),
                  React.createElement('span', null, groupLabel)
                ),
                React.createElement('span', { 
                  style: { 
                    fontSize: '10px', 
                    color: '#888',
                    fontStyle: 'italic',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  } 
                }, message || 'No data available')
              ) :
              // Single link - make the whole button a link
              isSingleLink ? React.createElement('a', {
                href: links[0].url,
                target: '_blank',
                rel: 'noopener noreferrer',
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 6px',
                  backgroundColor: isHovered ? '#f8f9fa' : '#ffffff',
                  border: `1px solid ${isHovered ? '#d0d7de' : '#e1e4e8'}`,
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: '#24292f',
                  transition: 'all 0.2s ease',
                  textDecoration: 'none',
                  boxShadow: isHovered ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }
              },
                React.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, flex: 1 } },
                  React.createElement('span', { style: { fontSize: '12px', flexShrink: 0 } }, icon || '🔗'),
                  React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, groupLabel)
                ),
                React.createElement('span', { style: { fontSize: '10px', color: '#656d76', flexShrink: 0, marginLeft: '4px' } }, '→')
              ) :
              // Multiple links - show dropdown on hover
              React.createElement('div', {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 6px',
                  backgroundColor: isHovered ? '#f8f9fa' : '#ffffff',
                  border: `1px solid ${isHovered ? '#d0d7de' : '#e1e4e8'}`,
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: '#24292f',
                  transition: 'all 0.2s ease',
                  boxShadow: isHovered ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }
              },
                React.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, flex: 1 } },
                  React.createElement('span', { style: { fontSize: '12px', flexShrink: 0 } }, icon || '🔗'),
                  React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, groupLabel)
                ),
                React.createElement('span', { style: { fontSize: '8px', color: '#656d76', transform: isHovered ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0, marginLeft: '4px' } }, '▼')
              ),
              isHovered && hasLinks && links.length > 1 && React.createElement('div', {
                style: {
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '2px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #d0d7de',
                  borderRadius: '3px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  zIndex: 10000,
                  padding: '2px 0',
                  overflow: 'visible',
                  minWidth: '150px'
                }
              },
                links.map((link, linkIdx) =>
                  React.createElement('a', {
                    key: linkIdx,
                    href: link.url,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    style: {
                      display: 'block',
                      padding: '6px 8px',
                      textDecoration: 'none',
                      color: '#24292f',
                      fontSize: '11px',
                      transition: 'background-color 0.15s',
                      borderBottom: linkIdx < links.length - 1 ? '1px solid #f0f0f0' : 'none',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    },
                    onMouseEnter: (e) => { e.target.style.backgroundColor = '#f6f8fa'; },
                    onMouseLeave: (e) => { e.target.style.backgroundColor = 'transparent'; }
                  }, link.label || link.url)
                )
              )
            );
          })
        )
      );
    }
    if (typeof extensionsAPI.registerStatusPanelExtension === 'function') {
      extensionsAPI.registerStatusPanelExtension(AppLinksComponent, 'GlueOps', 'glueops');
    }
    if (typeof extensionsAPI.registerAppViewExtension === 'function') {
      // Keep paperclip icon - no replacement needed
      extensionsAPI.registerAppViewExtension(AppLinksComponent, 'GlueOps', 'fa-link');
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExtension);
  } else {
    initExtension();
  }
})();
