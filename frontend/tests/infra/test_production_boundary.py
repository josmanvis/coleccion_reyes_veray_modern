import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[3]
def public_release_allowed_on_main(workflow):
    if not any(token in workflow for token in ('gcloud builds submit', 'gcloud run deploy', 'scripts/gcp-release.py')):
        return False
    return True

class ProductionBoundary(unittest.TestCase):
    def test_main_has_no_public_production_release(self):
        for path in (ROOT / '.github/workflows').glob('*'):
            self.assertFalse(public_release_allowed_on_main(path.read_text()), str(path))
    def test_main_deploy_command_is_rejected(self):
        self.assertTrue(public_release_allowed_on_main('push: branches: [main]\nrun: gcloud run deploy orc'))

if __name__ == '__main__': unittest.main()
